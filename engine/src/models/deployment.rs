use chrono::{DateTime, Utc};
use poem_openapi::{types::multipart::Upload, Object};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{query, query_as};
use async_zip::base::read::mem::ZipFileReader;
use tracing::info;

use crate::{
    database::Database,
    state::State,
    utils::id::{generate_id, IdType},
};

#[derive(Debug, Serialize, Deserialize, Object)]
pub struct Deployment {
    pub deployment_id: String,
    pub site_id: String,
    pub context: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Object)]
pub struct File {
    pub file_id: i64,
    pub file_hash: String,
    pub file_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Object)]
pub struct DeploymentFile {
    pub deployment_id: String,
    pub file_id: i64,
    pub file_path: String,
    pub mime_type: String,
}

impl Deployment {
    pub async fn new(
        db: &Database,
        site_id: String,
        context: Option<String>,
    ) -> Result<Self, sqlx::Error> {
        let deployment_id: String = generate_id(IdType::DEPLOYMENT);

        query_as!(
            Deployment,
            "INSERT INTO deployments (deployment_id, site_id, context) VALUES ($1, $2, $3) RETURNING *",
            deployment_id,
            site_id,
            context
        )
        .fetch_one(&db.pool)
        .await
    }

    // pub fn new(deployment_id: String, site_id: String, hash: String, storage: String) -> Self {
    //     Self {
    //         deployment_id,
    //         site_id,
    //         hash,
    //         storage,
    //         created_at: Utc::now(),
    //     }
    // }

    pub async fn upload_file(
        &self,
        db: &Database,
        file_path: impl AsRef<str>,
        file_hash: impl AsRef<str>,
        mime_type: impl AsRef<str>,
        file_size: i64,
    ) -> Result<NewlyCreatedFile, sqlx::Error> {
        // create a new file in `files` table
        // create a new `deployment_files` row in `deployment_files` table to link the file to the deployment

        let file_path = file_path.as_ref();
        let file_hash = file_hash.as_ref();
        let mime_type = mime_type.as_ref();

        tracing::info!("File path: {:?}", file_path);

        // insert into the `files` table by file_hash if it doesn't exist otherwise get the file_id
        let file = query_as!(
            NewlyCreatedFile,
            r#"
            WITH ins AS (
  INSERT INTO files (file_hash, file_size)
  VALUES ($1, $2)
  ON CONFLICT (file_hash) DO NOTHING
  RETURNING file_id, true AS is_new
)
SELECT file_id, is_new
FROM ins
UNION ALL
SELECT file_id, false AS is_new
FROM files
WHERE file_hash = $1
LIMIT 1;
            "#,
            file_hash,
            file_size
        )
        .fetch_one(&db.pool)
        .await?;

        tracing::info!("File: {:?}", file);

        let deployment_file = query_as!(
            DeploymentFile,
            "INSERT INTO deployment_files (deployment_id, file_id, file_path, mime_type) VALUES ($1, $2, $3, $4) RETURNING *",
            self.deployment_id,
            file.file_id,
            file_path,
            mime_type
        ).fetch_one(&db.pool).await?;

        Ok(file)
    }

    pub async fn upload_files(&self, state: &State, file: Upload) -> Result<(), sqlx::Error> {
        let content_type = file.content_type().unwrap().to_string();
        let file_stream = file.into_vec().await.unwrap();

        // TODO: Read file stream, extract zip file (contains multiple files), upload each file to s3 at the correct relevant path relative to deployment.deployment_id + '/'

        let zip = ZipFileReader::new(file_stream).await.unwrap();

        for index in 0..zip.file().entries().len() {
            let file = zip.file().entries().get(index).unwrap();
            let path = file.filename().as_str().unwrap();
            let entry_is_dir = file.dir().unwrap();

            if entry_is_dir {
                info!("Skipping directory: {:?}", path);
                continue;
            }

            let mut file_content = zip.reader_with_entry(index).await.unwrap();

            let mut buf = Vec::new();
            file_content.read_to_end_checked(&mut buf).await.unwrap();

            // hash the file
            info!("Hashing file: {:?}", path);
            let file_hash = hash_file(&buf);

            let content_type = infer::get(&buf)
                .map(|t| t.mime_type().to_string())
                .unwrap_or_default();
            let file_size = buf.len() as i64;

            info!("Cataloging metadata for file: {:?}", path);
            let x = self
                .upload_file(&state.database, path, &file_hash, &content_type, file_size)
                .await
                .unwrap();

            if x.is_new.unwrap_or_default() {
                info!("Uploading file: {:?}", path);

                let s3_path = file_hash.to_string();
                state
                    .storage
                    .bucket
                    .put_object_with_content_type(&s3_path, &buf, &content_type)
                    .await
                    .unwrap();

                info!("Upload complete");
            } else {
                info!("File already exists, skipping upload");
            }
        }

        Ok(())
    }

    // Go through all `files` where the `deployment_files` links it to a deployment_id from `deployments` table
    // if the file is not used by deployments > cutoff_date then return the file
    pub async fn cleanup_old_files(
        state: &State,
        cutoff_date: DateTime<Utc>,
    ) -> Result<Vec<File>, sqlx::Error> {
        tracing::info!("Checking for unused files before: {:?}", cutoff_date);
        let files = query_as!(
            File,
            r#"
            SELECT DISTINCT f.* 
            FROM files f
            WHERE NOT EXISTS (
                SELECT 1 
                FROM deployment_files df
                JOIN deployments d ON df.deployment_id = d.deployment_id
                WHERE df.file_id = f.file_id 
                AND d.created_at > $1
            )"#,
            cutoff_date
        )
        .fetch_all(&state.database.pool)
        .await?;

        tracing::info!("Found {} unused files", files.len());

        if files.len() > 0 {
            tracing::info!("Deleting {} unused files", files.len());

            // delete file from s3
            for file in &files {
                let s3_path = format!("sites/{}", file.file_hash);
                state.storage.bucket.delete_object(&s3_path).await.unwrap();
            }

            // delete the files from the `files` table
            query!(
                "DELETE FROM files WHERE file_id = ANY($1)",
                &files.iter().map(|f| f.file_id).collect::<Vec<i64>>()
            )
            .execute(&state.database.pool)
            .await?;
        }

        Ok(files)
    }

    pub async fn get_by_id(db: &Database, deployment_id: &str) -> Result<Self, sqlx::Error> {
        query_as!(
            Deployment,
            "SELECT * FROM deployments WHERE deployment_id = $1",
            deployment_id
        )
        .fetch_one(&db.pool)
        .await
    }
}

#[derive(Debug, Serialize, Deserialize, Object)]
pub struct NewlyCreatedFile {
    pub file_id: Option<i64>,
    pub is_new: Option<bool>,
}

impl DeploymentFile {
    pub async fn get_deployment_files(
        db: &Database,
        deployment_id: &str,
    ) -> Result<Vec<DeploymentFileEntry>, sqlx::Error> {
        query_as!(
            DeploymentFileEntry,
            r#"
            SELECT
                df.deployment_id as "deployment_file_deployment_id!",
                df.file_id as "deployment_file_file_id!",
                df.file_path as "deployment_file_file_path!",
                df.mime_type as "deployment_file_mime_type!",
                f.file_size
            FROM deployment_files df
            JOIN files f ON df.file_id = f.file_id
            WHERE df.deployment_id = $1
            "#,
            deployment_id
        )
        .fetch_all(&db.pool)
        .await
    }
}

// Add this new struct to represent the joined result
#[derive(Debug, sqlx::FromRow, Object)]
pub struct DeploymentFileEntry {
    pub deployment_file_deployment_id: String,
    pub deployment_file_file_id: i64,
    pub deployment_file_file_path: String,
    pub deployment_file_mime_type: String,
    pub file_size: Option<i64>,
}

fn hash_file(file: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(file);
    let hash = hasher.finalize();
    format!("{:x}", hash)
}

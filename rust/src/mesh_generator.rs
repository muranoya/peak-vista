use wasm_bindgen::prelude::*;
use glam::Vec3;

#[wasm_bindgen]
pub struct MeshData {
    vertices: Vec<f32>,
    indices: Vec<u32>,
    normals: Vec<f32>,
}

#[wasm_bindgen]
impl MeshData {
    /// Get pointer to vertices array for zero-copy access
    #[wasm_bindgen]
    pub fn vertices_ptr(&self) -> *const f32 {
        self.vertices.as_ptr()
    }

    /// Get number of vertices
    #[wasm_bindgen]
    pub fn vertices_len(&self) -> usize {
        self.vertices.len()
    }

    /// Get pointer to indices array
    #[wasm_bindgen]
    pub fn indices_ptr(&self) -> *const u32 {
        self.indices.as_ptr()
    }

    /// Get number of indices
    #[wasm_bindgen]
    pub fn indices_len(&self) -> usize {
        self.indices.len()
    }

    /// Get pointer to normals array
    #[wasm_bindgen]
    pub fn normals_ptr(&self) -> *const f32 {
        self.normals.as_ptr()
    }

    /// Get number of normal values
    #[wasm_bindgen]
    pub fn normals_len(&self) -> usize {
        self.normals.len()
    }

    /// Get vertices as a copied array (for JavaScript)
    #[wasm_bindgen]
    pub fn get_vertices(&self) -> Vec<f32> {
        self.vertices.clone()
    }

    /// Get indices as a copied array (for JavaScript)
    #[wasm_bindgen]
    pub fn get_indices(&self) -> Vec<u32> {
        self.indices.clone()
    }

    /// Get normals as a copied array (for JavaScript)
    #[wasm_bindgen]
    pub fn get_normals(&self) -> Vec<f32> {
        self.normals.clone()
    }
}

#[wasm_bindgen]
pub struct MeshGenerator {
    max_error: f32,
}

#[wasm_bindgen]
impl MeshGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(max_error: f32) -> MeshGenerator {
        MeshGenerator { max_error }
    }

    /// Generate terrain mesh from elevation data
    /// elevations: 256x256 heightmap (65536 values)
    /// tile_size: size of tile in world units
    /// lod_level: 0=far (low detail), 1=mid, 2=near (high detail)
    #[wasm_bindgen]
    pub fn generate(
        &self,
        elevations: &[f32],
        tile_size: f32,
        lod_level: u8,
    ) -> Result<MeshData, JsValue> {
        if elevations.len() != 65536 {
            return Err(JsValue::from_str(&format!(
                "Invalid elevation array length: {}, expected 65536",
                elevations.len()
            )));
        }

        // Calculate LOD parameters
        let step = match lod_level {
            0 => 8,  // Far: sample every 8 pixels (32x32 grid)
            1 => 4,  // Mid: sample every 4 pixels (64x64 grid)
            2 => 2,  // Near: sample every 2 pixels (128x128 grid)
            _ => return Err(JsValue::from_str("Invalid LOD level (0-2)")),
        };

        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let mut normals = Vec::new();

        // Create heightmap grid
        // Note: grid_size includes the edge vertices to ensure full tile coverage
        // to prevent gaps between adjacent tiles
        let grid_size = (256 / step) + 1;
        let pixel_size = tile_size / 256.0;

        // Generate vertices
        for y in 0..grid_size {
            for x in 0..grid_size {
                // Clamp to 255 to ensure we don't go beyond the heightmap
                let sample_x = (x * step).min(255);
                let sample_y = (y * step).min(255);

                let px = sample_x as f32;
                let py = sample_y as f32;

                let world_x = px * pixel_size - tile_size / 2.0;
                let world_z = py * pixel_size - tile_size / 2.0;

                let elevation_idx = (sample_y * 256 + sample_x) as usize;
                let world_y = elevations[elevation_idx];

                vertices.push(world_x);
                vertices.push(world_y);
                vertices.push(world_z);
            }
        }

        // Generate indices (simple triangle strip)
        // IMPORTANT: Winding order must be counter-clockwise when viewed from above
        // to ensure normals point outward (upward for terrain)
        for y in 0..(grid_size - 1) {
            for x in 0..(grid_size - 1) {
                let idx0 = y * grid_size + x;
                let idx1 = y * grid_size + (x + 1);
                let idx2 = (y + 1) * grid_size + x;
                let idx3 = (y + 1) * grid_size + (x + 1);

                // First triangle (counter-clockwise: 0, 2, 1)
                indices.push(idx0 as u32);
                indices.push(idx2 as u32);
                indices.push(idx1 as u32);

                // Second triangle (counter-clockwise: 1, 2, 3)
                indices.push(idx1 as u32);
                indices.push(idx2 as u32);
                indices.push(idx3 as u32);
            }
        }

        // Calculate normals using face normals
        normals.resize(vertices.len(), 0.0);

        for i in (0..indices.len()).step_by(3) {
            let idx0 = indices[i] as usize;
            let idx1 = indices[i + 1] as usize;
            let idx2 = indices[i + 2] as usize;

            let v0 = Vec3::new(
                vertices[idx0 * 3],
                vertices[idx0 * 3 + 1],
                vertices[idx0 * 3 + 2],
            );
            let v1 = Vec3::new(
                vertices[idx1 * 3],
                vertices[idx1 * 3 + 1],
                vertices[idx1 * 3 + 2],
            );
            let v2 = Vec3::new(
                vertices[idx2 * 3],
                vertices[idx2 * 3 + 1],
                vertices[idx2 * 3 + 2],
            );

            let edge1 = v1 - v0;
            let edge2 = v2 - v0;
            let normal = edge1.cross(edge2).normalize();

            // Accumulate normal to all three vertices
            for &idx in &[idx0, idx1, idx2] {
                normals[idx * 3] += normal.x;
                normals[idx * 3 + 1] += normal.y;
                normals[idx * 3 + 2] += normal.z;
            }
        }

        // Normalize vertex normals
        for i in (0..normals.len()).step_by(3) {
            let normal = Vec3::new(normals[i], normals[i + 1], normals[i + 2]);
            let normalized = normal.normalize();
            normals[i] = normalized.x;
            normals[i + 1] = normalized.y;
            normals[i + 2] = normalized.z;
        }

        Ok(MeshData {
            vertices,
            indices,
            normals,
        })
    }
}

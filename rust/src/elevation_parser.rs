use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct ElevationParser;

#[wasm_bindgen]
impl ElevationParser {
    /// Parse PNG-encoded elevation data from GSI
    /// PNG format: (R*256^2 + G*256 + B) * 0.01 - 10000
    /// 256x256 image = 65536 elevation values
    #[wasm_bindgen]
    pub fn parse_png(data: &[u8]) -> Result<Vec<f32>, JsValue> {
        // Use image crate to decode PNG
        let reader = image::io::Reader::new(std::io::Cursor::new(data))
            .with_guessed_format()
            .map_err(|e| JsValue::from_str(&format!("Failed to read PNG: {}", e)))?;

        let image = reader
            .decode()
            .map_err(|e| JsValue::from_str(&format!("Failed to decode PNG: {}", e)))?;

        let rgb_image = image.to_rgb8();

        // Ensure we have exactly 256x256 pixels
        if rgb_image.width() != 256 || rgb_image.height() != 256 {
            return Err(JsValue::from_str(&format!(
                "Invalid image size: {}x{}, expected 256x256",
                rgb_image.width(),
                rgb_image.height()
            )));
        }

        let mut elevations = Vec::with_capacity(65536);

        // Process each pixel
        for pixel in rgb_image.pixels() {
            let r = pixel[0] as u32;
            let g = pixel[1] as u32;
            let b = pixel[2] as u32;

            // Check for "no data" value (2^23 = 8388608)
            let combined = (r << 16) | (g << 8) | b;
            if combined == 8388608 {
                // No data - use 0 or interpolate later
                elevations.push(0.0);
            } else {
                // Convert to elevation in meters
                let elevation = (combined as f32) * 0.01 - 10000.0;
                elevations.push(elevation);
            }
        }

        Ok(elevations)
    }

    /// Parse text-encoded elevation data from GSI
    /// Format: 256 comma-separated values per line, 256 lines
    #[wasm_bindgen]
    pub fn parse_txt(data: &str) -> Result<Vec<f32>, JsValue> {
        let mut elevations = Vec::with_capacity(65536);

        for line in data.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            for value_str in line.split(',') {
                let value_str = value_str.trim();

                // Handle "e" for no data
                if value_str == "e" {
                    elevations.push(0.0);
                } else {
                    match value_str.parse::<f32>() {
                        Ok(elevation) => elevations.push(elevation),
                        Err(_) => {
                            return Err(JsValue::from_str(&format!(
                                "Failed to parse elevation value: {}",
                                value_str
                            )))
                        }
                    }
                }
            }
        }

        if elevations.len() != 65536 {
            return Err(JsValue::from_str(&format!(
                "Invalid number of elevation values: {}, expected 65536",
                elevations.len()
            )));
        }

        Ok(elevations)
    }

    /// Get pointer to elevation data for zero-copy access
    #[wasm_bindgen]
    pub fn get_elevation_array_ptr(elevations: &[f32]) -> *const f32 {
        elevations.as_ptr()
    }

    /// Get length of elevation array
    #[wasm_bindgen]
    pub fn get_elevation_array_len(elevations: &[f32]) -> usize {
        elevations.len()
    }
}

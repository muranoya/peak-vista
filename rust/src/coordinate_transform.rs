use wasm_bindgen::prelude::*;
use std::f64::consts::PI;

#[wasm_bindgen]
pub struct CoordinateTransform;

#[wasm_bindgen]
impl CoordinateTransform {
    /// Convert latitude to tile Y coordinate at given zoom level
    #[wasm_bindgen]
    pub fn latlon_to_tile_x(lon: f64, zoom: u8) -> u32 {
        let n = (1u32 << zoom) as f64;
        ((lon + 180.0) / 360.0 * n) as u32
    }

    /// Convert longitude to tile X coordinate at given zoom level
    #[wasm_bindgen]
    pub fn latlon_to_tile_y(lat: f64, zoom: u8) -> u32 {
        let n = (1u32 << zoom) as f64;
        let lat_rad = lat * PI / 180.0;
        ((1.0 - (lat_rad.tan() + lat_rad.sec()).ln() / PI) / 2.0 * n) as u32
    }

    /// Convert tile X coordinate to longitude (tile center)
    #[wasm_bindgen]
    pub fn tile_x_to_lon(tile_x: u32, zoom: u8) -> f64 {
        let n = (1u32 << zoom) as f64;
        let x = (tile_x as f64 + 0.5) / n;
        x * 360.0 - 180.0
    }

    /// Convert tile Y coordinate to latitude (tile center)
    #[wasm_bindgen]
    pub fn tile_y_to_lat(tile_y: u32, zoom: u8) -> f64 {
        let n = (1u32 << zoom) as f64;
        let y = (tile_y as f64 + 0.5) / n;
        (2.0 * PI * (y - 0.5)).atan().to_degrees()
    }

    /// Get world X position of tile at given zoom level
    #[wasm_bindgen]
    pub fn tile_x_to_world_x(tile_x: u32, tile_size: f32) -> f32 {
        tile_x as f32 * tile_size
    }

    /// Get world Z position of tile at given zoom level
    #[wasm_bindgen]
    pub fn tile_y_to_world_z(tile_y: u32, tile_size: f32) -> f32 {
        tile_y as f32 * tile_size
    }

    /// Scale elevation value (apply vertical exaggeration if needed)
    #[wasm_bindgen]
    pub fn scale_elevation(elevation_m: f32, exaggeration: f32) -> f32 {
        elevation_m * exaggeration
    }

    /// Calculate distance between two lat/lon points in kilometers (Haversine formula)
    #[wasm_bindgen]
    pub fn distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        const EARTH_RADIUS_KM: f64 = 6371.0;

        let lat1_rad = lat1 * PI / 180.0;
        let lat2_rad = lat2 * PI / 180.0;
        let delta_lat = (lat2 - lat1) * PI / 180.0;
        let delta_lon = (lon2 - lon1) * PI / 180.0;

        let a = (delta_lat / 2.0).sin().powi(2)
            + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

        EARTH_RADIUS_KM * c
    }
}

trait SecantExt {
    fn sec(self) -> f64;
}

impl SecantExt for f64 {
    fn sec(self) -> f64 {
        1.0 / self.cos()
    }
}

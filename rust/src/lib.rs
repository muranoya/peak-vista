use wasm_bindgen::prelude::*;

mod elevation_parser;
mod mesh_generator;
mod coordinate_transform;

pub use elevation_parser::ElevationParser;
pub use mesh_generator::MeshGenerator;
pub use coordinate_transform::CoordinateTransform;

// Web console logging for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

// Export version info for debugging
#[wasm_bindgen]
pub fn get_version() -> String {
    format!("peak-vista-wasm v{}", env!("CARGO_PKG_VERSION"))
}

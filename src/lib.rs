#[macro_use]
extern crate log;
extern crate libc;
extern crate lru_cache;
extern crate wait_timeout;

use lru_cache::LruCache;

use std::io;
use std::process::ExitStatus;
use std::sync::Mutex;
use std::time::Duration;

use docker::Container;

mod docker;

pub struct Cache {
    cache: Mutex<LruCache<CacheKey, (ExitStatus, Vec<u8>)>>,
}

#[derive(PartialEq, Eq, Hash)]
struct CacheKey {
    cmd: String,
    input: String,
}

impl Cache {
    pub fn new() -> Cache {
        Cache {
            cache: Mutex::new(LruCache::new(256)),
        }
    }

    /// Helper method for safely invoking a command inside a playpen
    pub fn exec(&self, cmd: &str, input: String) -> io::Result<(ExitStatus, Vec<u8>)> {
        // Build key to look up
        let key = CacheKey {
            cmd: cmd.to_string(),
            input: input,
        };
        let mut cache = self.cache.lock().unwrap();
        if let Some(prev) = cache.get_mut(&key) {
            return Ok(prev.clone())
        }
        drop(cache);

        let container = "l4t-playpen";
        let container = Container::new(cmd, &container)?;

        let tuple = container.run(key.input.as_bytes(), Duration::new(5, 0))?;
        let (status, mut output, timeout) = tuple;
        if timeout {
            output.extend_from_slice(b"\ntimeout triggered!");
        }
        let mut cache = self.cache.lock().unwrap();
        if status.success() {
            cache.insert(key, (status.clone(), output.clone()));
        }
        Ok((status, output))
    }
}

// Highlights compiled rustc output according to the given output format
// pub fn highlight(output: &str) -> String {
//     let lexer = "gas";

//     let mut child = Command::new("pygmentize")
//                             .arg("-l")
//                             .arg(lexer)
//                             .arg("-f")
//                             .arg("html")
//                             .stdin(Stdio::piped())
//                             .stdout(Stdio::piped())
//                             .spawn().unwrap();
//     child.stdin.take().unwrap().write_all(output.as_bytes()).unwrap();
//     let output = child.wait_with_output().unwrap();
//     assert!(output.status.success());
//     String::from_utf8(output.stdout).unwrap()
// }

// #[cfg(test)]
// mod tests {
//     extern crate env_logger;

//     use super::*;

//     /// Validate the version and return out with the first line (version) removed
//     fn validate_and_remove_version<'a>(out: &'a [u8], expected: Option<&str>) -> &'a [u8] {
//         let mut split = out.splitn(2, |&b| b == b'\n');
//         let version = split.next().unwrap();
//         let out = split.next().unwrap();

//         assert!(version.starts_with(b"rustc "));

//         if let Some(expectation) = expected {
//             assert!(String::from_utf8_lossy(version).contains(expectation));
//         }

//         out
//     }

//     #[test]
//     fn versions() {
//         fn check(expectation: Option<&str>) {
//             let cache = Cache::new();
//             let input = r#"fn main() {}"#;

//             let (status, out) = cache.exec("/usr/local/bin/evaluate.sh", input.into()).unwrap();

//             assert!(status.success());
//             validate_and_remove_version(&out.as_ref(), expectation);
//         }

//         drop(env_logger::init());
//     }

//     #[test]
//     fn eval() {
//         drop(env_logger::init());

//         let cache = Cache::new();
//         let input = r#"fn main() { println!("Hello") }"#;
//         let (status, out) = cache.exec("/usr/local/bin/evaluate.sh", input.to_string()).unwrap();
//         assert!(status.success());
//         let out = validate_and_remove_version(&out.as_ref(), None);
//         assert_eq!(out, &[0xff, b'H', b'e', b'l', b'l', b'o', b'\n']);
//     }

//     #[test]
//     fn timeout() {
//         drop(env_logger::init());

//         let cache = Cache::new();
//         let input = r#"
//             fn main() {
//                 std::thread::sleep_ms(10_000);
//             }
//         "#;
//         let (status, out) = cache.exec("/usr/local/bin/evaluate.sh", input.to_string()).unwrap();
//         assert!(!status.success());
//         assert!(String::from_utf8_lossy(&out).contains("timeout triggered"));
//     }

//     #[test]
//     fn compile() {
//         drop(env_logger::init());

//         let cache = Cache::new();
//         let input = r#"fn main() { println!("Hello") }"#;
//         let (status, out) = cache.exec("/usr/local/bin/compile.sh", input.to_string()).unwrap();

//         assert!(status.success());
//         let out = validate_and_remove_version(&out, None);
//         let mut split = out.splitn(2, |b| *b == b'\xff');
//         let empty: &[u8] = &[];
//         assert_eq!(split.next().unwrap(), empty);
//         assert!(String::from_utf8(split.next().unwrap().to_vec()).unwrap()
//             .contains("target triple"));
//     }
// }

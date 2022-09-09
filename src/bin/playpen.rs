#[macro_use] extern crate iron;
extern crate log;
extern crate env_logger;
extern crate hyper;
extern crate l4t_playpen;
extern crate router;
extern crate rustc_serialize;
extern crate staticfile;
extern crate unicase;

use std::env;
use std::fmt;
use std::io::Read;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use hyper::header;
use iron::headers;
use iron::method::Method;
use iron::middleware::{BeforeMiddleware, AfterMiddleware};
use iron::modifiers::Header;
use iron::typemap;
use iron::prelude::*;
use iron::status;
use iron::headers::HeaderFormat;
use l4t_playpen::*;
use router::Router;
use rustc_serialize::json;
use staticfile::Static;
use unicase::UniCase;

#[derive(Clone, Debug)]
struct XXssProtection(bool);

impl header::Header for XXssProtection {
    fn header_name() -> &'static str {
        "X-XSS-Protection"
    }

    fn parse_header(raw: &[Vec<u8>]) -> hyper::Result<Self> {
        if raw.len() == 1 {
            let line = &raw[0];
            if line.len() == 1 {
                let byte = line[0];
                match byte {
                    b'1' => return Ok(XXssProtection(true)),
                    b'0' => return Ok(XXssProtection(false)),
                    _ => ()
                }
            }
        }
        Err(hyper::Error::Header)
    }
}

impl HeaderFormat for XXssProtection {
    fn fmt_header(&self, f: &mut fmt::Formatter) -> fmt::Result {
        if self.0 {
            f.write_str("1")
        } else {
            f.write_str("0")
        }
    }
}

fn index(_: &mut Request) -> IronResult<Response> {
    Ok(Response::with((status::Ok,
                       Path::new("static/web.html"),
                       Header(XXssProtection(false)))))
}

/// The JSON-encoded request sent to `evaluate.json`.
#[derive(RustcDecodable)]
struct EvaluateReq {
    code: String,
}

fn evaluate(req: &mut Request) -> IronResult<Response> {
    let mut body = String::new();
    itry!(req.body.read_to_string(&mut body));

    let data: EvaluateReq = itry!(json::decode(&body));

    let cache = req.extensions.get::<AddCache>().unwrap();
    let (_status, output) = itry!(cache.exec("/usr/local/bin/evaluate.sh", data.code));

    let mut obj = json::Object::new();
    // {"result": "..."}
    let result = String::from_utf8_lossy(&output);

    obj.insert(String::from("result"), json::Json::String(result.to_string()));

    Ok(Response::with((status::Ok, format!("{}", json::Json::Object(obj)))))
}

#[derive(RustcDecodable)]
struct CompileReq {
    code: String,
}

fn compile(req: &mut Request) -> IronResult<Response> {
    let mut body = String::new();
    itry!(req.body.read_to_string(&mut body));

    let data: CompileReq = itry!(json::decode(&body));

    let cache = req.extensions.get::<AddCache>().unwrap();
    let (_status, output) = itry!(cache.exec("/usr/local/bin/compile.sh", data.code));

    let mut obj = json::Object::new();

    let result = String::from_utf8_lossy(&output);

    obj.insert(String::from("result"), json::Json::String(result.to_string()));

    Ok(Response::with((status::Ok, format!("{}", json::Json::Object(obj)))))
}

// This is neat!
struct EnablePostCors;
impl AfterMiddleware for EnablePostCors {
    fn after(&self, _: &mut Request, res: Response) -> IronResult<Response> {
        Ok(res.set(Header(headers::AccessControlAllowOrigin::Any))
              .set(Header(headers::AccessControlAllowMethods(
                  vec![Method::Post,
                       Method::Options])))
              .set(Header(headers::AccessControlAllowHeaders(
                  vec![UniCase(String::from("Origin")),
                       UniCase(String::from("Accept")),
                       UniCase(String::from("Content-Type"))]))))
    }
}

struct AddCache {
    cache: Arc<Cache>,
}

impl typemap::Key for AddCache { type Value = Arc<Cache>; }

impl BeforeMiddleware for AddCache {
    fn before(&self, req: &mut Request) -> IronResult<()> {
        req.extensions.insert::<AddCache>(self.cache.clone());
        Ok(())
    }
}

fn main() {
    env_logger::init().unwrap();

    // Make sure pygmentize is installed before starting the server
    Command::new("pygmentize").spawn().unwrap().kill().unwrap();

    let mut router = Router::new();
    router.get("/", index, "root");
    router.get("/:path", Static::new("static"), "static-file");
    router.post("/evaluate.json", evaluate, "evaluate.json");
    router.post("/compile.json", compile, "compile.json");

    // Use our router as the middleware, and pass the generated response through `EnablePostCors`
    let mut chain = Chain::new(router);
    chain.link_before(AddCache { cache: Arc::new(Cache::new()) });
    chain.link_after(EnablePostCors);

    let addr = env::args().skip(1).next().unwrap_or("127.0.0.1".to_string());
    let addr = (&addr[..], 8080);
    println!("listening on {:?}", addr);
    Iron::new(chain).http(addr).unwrap();
}

// #[test]
// fn web_has_version() {
//     drop(env_logger::init());

//     let cache = Cache::new();
//     let input = r#"fn main() {}"#;

//     let (status, out) = cache.exec("/usr/local/bin/evaluate.sh", input.into()).unwrap();

//     assert!(status.success());
//     assert!(String::from_utf8_lossy(&out).contains("rustc "));
// }

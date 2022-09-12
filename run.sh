#!/bin/bash
cargo build --release --bin playpen
sudo setcap CAP_NET_BIND_SERVICE+ep ./target/release/playpen
RUST_LOG=debug nohup ./target/release/playpen 0.0.0.0 2>&1 | logger -t playpen &
tail -f -n 30  /var/log/syslog | grep playpen

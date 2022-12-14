# L4T-Playpen

A web interface for running L4T code.
See <https://github.com/take44444/l4tc> about L4T.

## System Requirements

Currently needs to be run on a system with access to Docker.
(cargo 1.63.0 (fd9c4297c 2022-07-01))

## Running the web server

First, create the Docker images that playpen will use:

```bash
$ sh docker/build.sh
```

Next, spin up the server.

```bash
$ cargo run --bin playpen
```

You should now be able to browse http://127.0.0.1:80 and interact.

# Setting up the l4t-playpen server

```bash
$ sudo apt-get update
$ sudo apt-get install python-pip apt-transport-https ca-certificates libssl-dev pkg-config
$ sudo pip install pygments

$ curl https://sh.rustup.rs | sh
git clone https://github.com/rust-lang/rust-playpen

# see https://docs.docker.com/engine/installation/linux/ubuntulinux/
$ sudo apt-key adv --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 58118E89F3A912897C070ADBF76221572C52609D
$ echo 'deb https://apt.dockerproject.org/repo ubuntu-xenial main' | sudo tee /etc/apt/sources.list.d/docker.list
$ sudo apt-get update
$ sudo apt-get install linux-image-extra-$(uname -r) docker-engine
$ sudo service docker start
$ sudo usermod -aG docker ubuntu
```

```bash
$ cargo build --release --bin playpen && RUST_LOG=debug ./target/release/playpen 0.0.0.0 2>&1 | logger -t playpen
```

Add a cron job to update the containers daily, currently:

```bash
0 10 * * * cd $HOME/rust-playpen && sh docker/build.sh 2>&1 | logger -t playpen-update
```

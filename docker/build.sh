#!/bin/sh

docker build \
    --no-cache \
    --force-rm \
    --pull \
    --rm \
    --tag l4t-playpen \
    --file docker/Dockerfile \
    docker

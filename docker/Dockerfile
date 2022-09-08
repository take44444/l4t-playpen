FROM ubuntu:20.04

RUN apt-get update
RUN apt-get install -y --no-install-recommends \
      gcc libc6-dev curl file ca-certificates build-essential
COPY bin/compile.sh bin/evaluate.sh l4tc /usr/local/bin/
USER nobody

WORKDIR /tmp

FROM ubuntu:20.04

RUN apt-get update
RUN apt-get install -y --no-install-recommends \
      build-essential curl file ca-certificates
COPY bin/compile.sh bin/evaluate.sh l4tc /usr/local/bin/
USER nobody

WORKDIR /tmp

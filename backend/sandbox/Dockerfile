FROM node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git python3 python3-pip build-essential curl nano vim \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
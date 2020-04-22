FROM ubuntu:20.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get install -y git curl build-essential procps
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i 10.20.1 --no-progress && nvm i --no-progress 12.16.2 && nvm i --no-progress 13.13.0 && nvm i --no-progress 14.0.0 " ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 14" ]
ENV DEBIAN_FRONTEND=dialog

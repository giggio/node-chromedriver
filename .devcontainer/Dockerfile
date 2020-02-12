FROM ubuntu:19.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get install -y git curl build-essential procps
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i 10.19.0 --no-progress && nvm i --no-progress 12.12.0 && nvm i --no-progress 13.8.0" ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 13" ]
ENV DEBIAN_FRONTEND=dialog

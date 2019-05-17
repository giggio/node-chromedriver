FROM ubuntu:19.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get install -y git curl build-essential procps
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i --no-progress 6 && nvm i 8 --no-progress && nvm i 10 --no-progress && nvm i --no-progress 12.2.0" ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 12" ]
ENV DEBIAN_FRONTEND=dialog

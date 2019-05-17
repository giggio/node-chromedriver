FROM ubuntu:19.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
  apt-get install -y git curl build-essential procps
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i 6 && nvm i 8 && nvm i 10 && nvm i 12.2.0" ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 12" ]
ENV DEBIAN_FRONTEND=dialog

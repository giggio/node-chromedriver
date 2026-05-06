FROM ubuntu:26.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
ARG USERNAME=ubuntu
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN apt-get update && \
  apt-get install -y git curl build-essential procps sudo
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
  && chmod 0440 /etc/sudoers.d/$USERNAME
USER $USERNAME
RUN curl -fsSL https://github.com/nvm-sh/nvm/raw/refs/tags/v0.40.4/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i --no-progress 22.22.2 && nvm i --no-progress 24.15.0 && nvm i --no-progress 26.0.0" ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 26" ]
ENV DEBIAN_FRONTEND=dialog

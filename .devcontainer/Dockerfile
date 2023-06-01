FROM ubuntu:22.04
LABEL maintainer="Giovanni Bassi <giggio@giggio.net>"

ENV DEBIAN_FRONTEND=noninteractive
ARG USERNAME=user
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
  && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME

RUN apt-get update && \
  apt-get install -y git curl build-essential procps sudo
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
  && chmod 0440 /etc/sudoers.d/$USERNAME
USER $USERNAME
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm i --no-progress 16.20.0 && nvm i --no-progress 18.16.0 && nvm i --no-progress 20.2.0" ]
RUN [ "/bin/bash", "-c", "source $HOME/.nvm/nvm.sh && nvm alias default 20" ]
ENV DEBIAN_FRONTEND=dialog

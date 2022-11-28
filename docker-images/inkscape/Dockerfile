FROM ubuntu:20.04
# version is pinned to have a more stable result

ARG DEBIAN_FRONTEND="noninteractive"
# this version was found by using apt-cache policy inkscape to find the version apt tries to install
ARG INKSCAPE_VERSION="1:1.2*"

RUN apt-get update && \
  apt-get install -y software-properties-common && \
  add-apt-repository ppa:inkscape.dev/stable && \
  apt-get update && \
  apt-get install -y inkscape=$INKSCAPE_VERSION && \
  apt-get remove -y software-properties-common && \
  apt-get autoremove -y && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

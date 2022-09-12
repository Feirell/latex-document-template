# syntax=docker/dockerfile:1.3

# see https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/syntax.md
# for buildkit specific options like RUN --mount
# and https://docs.docker.com/engine/reference/builder/
# for general information

##
## #####################
## BASE IMAGES
## #####################
##

FROM ubuntu:20.04 as inkscape-img
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

FROM ubuntu:20.04 as plantuml-img

ARG DEBIAN_FRONTEND="noninteractive"
# found by choosing one of the github tags
ARG PLANTUML_VERSION="1.2022.0"

RUN apt-get update && \
   apt-get install -y curl openjdk-17-jre && \
   curl -L https://github.com/plantuml/plantuml/releases/download/v$PLANTUML_VERSION/plantuml-$PLANTUML_VERSION.jar -o /etc/plantuml.jar && \
   apt-get remove -y curl && \
   apt-get autoremove -y && \
   apt-get clean && \
   rm -rf /var/lib/apt/lists/* && \
   echo "#!/bin/bash" >> /bin/plantuml && \
   echo "java -jar /etc/plantuml.jar -charset UTF-8 \$*" >> /bin/plantuml && \
   chmod +x /bin/plantuml

##
## #####################
## ACTUAL BUILD STAGES
## #####################
##

FROM plantuml-img as plantuml-files

COPY plant-diagrams /plantfiles/

RUN plantuml -tsvg /plantfiles/*.plant

FROM inkscape-img as plantuml-pdfs

COPY --from=plantuml-files /plantfiles/*.svg /svgs/

RUN inkscape --export-type=pdf /svgs/*.svg

FROM texlive/texlive:TL2021-historic as latex

WORKDIR /latex-document

COPY *.bib *.tex   ./
COPY medien        ./medien
COPY chapters      ./chapters
COPY meta-tex      ./meta-tex
COPY --from=plantuml-pdfs \
     /svgs/*.pdf   ./medien/plant/

RUN latexmk \
      -pdf \
      -shell-escape \
      -file-line-error \
      -halt-on-error \
      -interaction=nonstopmode \
      -aux-directory=build \
      -output-directory=build \
      document.tex

FROM scratch as build-results

# collect all results in the scratch image and then write them back to the file system
# with the --output type=local,dest=/some/path
COPY --from=latex /latex-document/build/document.pdf .

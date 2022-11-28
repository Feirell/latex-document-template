# syntax=docker/dockerfile:1.3

# see https://github.com/moby/buildkit/blob/master/frontend/dockerfile/docs/syntax.md
# for buildkit specific options like RUN --mount
# and https://docs.docker.com/engine/reference/builder/
# for general information

# docker1234123123 is my account, I am using it as a build storage, so the base images don't need
# to be cached or otherwise rebuild on each new build.
# The GitHub CI is the main problem in this regard
# If you don't want to use those you can build them yourself and add reference here.
# Either by copying them into this Dockefile and then using the as <NAME> for the from or by building them seperatly.

# docker build -f docker-images/plantuml/Dockerfile -t plantuml:v1.2022.0 docker-images/plantuml
# then replace
# FROM docker1234123123/plantuml:v1.2022.0 as plantuml-files
# with
# FROM plantuml:v1.2022.0 as plantuml-files


FROM docker1234123123/plantuml:v1.2022.0 as plantuml-files

COPY plant-diagrams /plantfiles/

RUN plantuml -tsvg /plantfiles/*.plant

FROM docker1234123123/inkscape:v1.2 as plantuml-pdfs

COPY --from=plantuml-files /plantfiles/*.svg /svgs/

RUN inkscape --export-type=pdf /svgs/*.svg

FROM node:18.12 as latex-with-old-diff

ARG PREVIOUS_IDENTIFIER="previous-version"
ARG CURRENT_IDENTIFIER="working"

WORKDIR /versions

COPY .               ./working
COPY ./write-diff.js ./write-diff.js

# You can use a git tag, git hash, "working", "previous-version" and "current-version"
# to denote the last and current version
RUN node write-diff.js $PREVIOUS_IDENTIFIER $CURRENT_IDENTIFIER

FROM docker1234123123/texlive:v2021 as latex-diff-tex

WORKDIR /latex-document

COPY --from=latex-with-old-diff \
     /versions ./

RUN ./todo.bash

FROM docker1234123123/texlive:v2021 as latex-diff-build

ARG ENTRY_FILE=document

WORKDIR /latex-document

COPY *.bib *.tex               ./
COPY medien                    ./medien
COPY chapters                  ./chapters
COPY meta-tex                  ./meta-tex
COPY --from=plantuml-pdfs \
     /svgs/*.pdf   ./medien/plant/
COPY --from=latex-diff-tex \
     /latex-document/diff   ./
COPY --from=latex-diff-tex \
     /latex-document/delta.txt ./delta.txt

RUN latexmk \
      -pdf \
      -shell-escape \
      -file-line-error \
      -halt-on-error \
      -interaction=nonstopmode \
      -aux-directory=build \
      -output-directory=build \
      $ENTRY_FILE.tex && \
    mv build/$ENTRY_FILE.pdf build/${ENTRY_FILE}-diff-$(cat delta.txt).pdf


FROM docker1234123123/texlive:v2021 as latex-build

ARG ENTRY_FILE=document

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
      $ENTRY_FILE.tex


FROM scratch as build-results

ARG ENTRY_FILE=document

# collect all results in the scratch image and then write them back to the file system
# with the --output type=local,dest=/some/path
COPY --from=latex-build      /latex-document/build/$ENTRY_FILE.pdf .
COPY --from=latex-diff-build /latex-document/build/${ENTRY_FILE}-diff-*.pdf .

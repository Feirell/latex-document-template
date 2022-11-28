FROM ubuntu:20.04

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

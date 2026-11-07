# Local Jenkins LTS fixture for the #319 external-runner acceptance.
#
# This image exists only so an operator can prove that a real Jenkins job runs
# the same repository commands as the local journey. It is built on the
# operator's machine for one bounded run. It is not a hosted service, a
# scheduled daemon, a deployment hook or a GitHub Actions replacement.
#
# Build (the fixture script does this automatically when the tag is absent):
#   docker build -f examples/jenkins/Dockerfile -t composer-jenkins-fixture:lts-node22 examples/jenkins
FROM jenkins/jenkins:lts-jdk21

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
 && rm -rf /var/lib/apt/lists/*

# The fixture repository is mounted from the host under a different uid. This
# image is disposable and never touches a real repository.
RUN git config --system --add safe.directory '*'

ARG NODE_VERSION=22.23.4
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      aarch64|arm64) node_arch=arm64 ;; \
      x86_64|amd64) node_arch=x64 ;; \
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
    rm /tmp/node.tar.xz; \
    node --version; npm --version

ARG PNPM_VERSION=12.8.1
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm --version

USER jenkins

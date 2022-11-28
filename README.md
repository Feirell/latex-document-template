# LaTeX document creation 

## Building

> If you encounter a build error try commenting the line 
> `COPY --from=latex-diff-build /latex-document/build/${ENTRY_FILE}-diff-*.pdf .` in the
> multi.Dockerfile to test if the error is raised while generating the diff file which is rather unstable

_`[WIN]` Windows only steps, all commands are to be run in the WSL Linux distribution_

### Installation

- `[WIN]` Install WSL 2
- `[WIN]` Install a distribution which is supported by docker
- Install docker in your linux environment, follow the appropriate steps (e.g. for Ubuntu https://docs.docker.com/engine/install/ubuntu/)
- `[WIN]` Start the docker daemon via `service docker start` (everytime you restart the WSL e.g. when restarting your windows)
- Make sure that `docker buildx version` works and prints a version

### Compiling the `.tex` to a `.pdf`

- `[WIN]` Specify the windows source directory  
  ```bash
  export LAT_WIN=/mnt/c/Users/<YOUR-USERNAME>/latex-files/
  ```
- Specify the directory for the source files
  ```bash
  export LAT_LIN=/root/latex-files/
  ```
- `[WIN]` Transfer / update all files to the WSL
  ```bash
  rsync -vtr --exclude /.git --exclude /.idea $LAT_WIN $LAT_LIN
  ```
- Define the output directory
  ```bash
  export LAT_OUT=$LAT_LIN
  ```
- `[WIN]` For windows you can use the Windows directory directly as output
  ```bash
  export LAT_OUT=$LAT_WIN
  ```  
- Using docker multistage (via Buildkit) to create the build images, convert all files and render the pdf
  ```bash
  docker buildx build --target build-results --file $LAT_LIN/multi.Dockerfile --output type=local,dest=$LAT_OUT $LAT_LIN
  ```
  The initial build is somewhat slow, but all subsequent build are much faster (around 30 seconds for tex => pdf)
  You can use `--progress=plain` to force the full output of the build. 


Example bash script

```bash
#! /usr/bin/bash

export WIN=/mnt/c/Users/Flo/projects/$1/
export LIN=/root/mirrors/$1/

mkdir -p $LIN

rsync -vtr --exclude /.git --exclude /.idea --exclude /dist --exclude lib $WIN $LIN

docker buildx build --target $2 --output type=local,dest=$WIN --file $LIN/multi.Dockerfile $LIN
```

Called with `./mirror bachelor-thesis-document build-results`

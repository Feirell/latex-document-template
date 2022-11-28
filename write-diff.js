const pathUtils = require("node:path");
const fs = require("node:fs");
const child = require("node:child_process");

const [
  _node,
  _script,
  previousVersion = 'HEAD^',
  currentVersion = 'HEAD'
] = process.argv;

const diffToDoPath = 'todo.bash';
const deltaNotation = 'delta.txt';

const workingDirName = 'working';
const previousFilesDirName = 'prev';
const currentFilesDirName = 'curr';
const diffFilesDirName = 'diff';

function git(...args) {
  return gitDir('./', ...args);
}

function gitDir(dir, ...args) {
  const cwd = pathUtils.resolve(dir);
  const encoding = 'utf-8';

  return child.execFileSync('git', args, {cwd, encoding});
}

function* lineSplit(text) {
  for (let line of text.split('\n')) {
    line = line.trim();
    if (line)
      yield line;
  }
}

function getTags(gitP = git) {
  return lineSplit(gitP('tag', '--list'));
}

function getTagsAtRev(rev, gitP = git) {
  return lineSplit(gitP('tag', '--points-at', rev));
}

function* getVersions(gitP = git) {
  for (const tag of getTags(gitP)) {
    const match = /^v?([0-9]+(?:\.[0-9]+)*)$/.exec(tag);
    if (match === null)
      continue;

    const [fullMatch, versionSegmentsStrings] = match;
    const versionSegments = versionSegmentsStrings.split('.').map(s => Number.parseInt(s));

    yield {tag, versionSegments};
  }
}

function getSortedVersionTags(gitP = git) {
  return [...getVersions(gitP)].sort((a, b) => {
    const vsA = a.versionSegments;
    const vsB = b.versionSegments;

    for (let i = 0; i < Math.max(vsA.length, vsB.length); i++) {
      const nrA = i < vsA.length ? vsA[i] : 0;
      const nrB = i < vsB.length ? vsB[i] : 0;

      if (nrA < nrB)
        return -1;
      else if (nrA > nrB)
        return 1;

      // The next segment is checked if they are equal
    }

    // All segments have been checked, they are all equal so
    // the two tags are identical.
    // This can happen if the tags are written differently but
    // represent the same number.
    // E.g.: v0.0 == 0 == v0
    return vsA.tag.length - vsB.tag.length;
  });
}

function resolveNaming(name, gitP = (...args) => gitDir(pathUtils.resolve(workingDirName), ...args)) {

  if (name === 'working') {
    try {
      // This will fail if we can not commit, which might be the case
      // if there is nothing to commit.
      gitP('add', '.');
      console.log(gitP('commit', '-m', '"WIP - for diff"'));
    } catch (e) {

    }

    return resolveNaming('HEAD', gitP);
  } else if (name === 'previous-version' || name === 'current-version') {
    const sortedVersionTags = getSortedVersionTags(gitP);

    const tag = name === 'previous-version' ?
      sortedVersionTags[sortedVersionTags.length - 2] :
      sortedVersionTags[sortedVersionTags.length - 1];

    if (tag === undefined) {
      const availableTags = sortedVersionTags.map(t => t.tag).join(', ');
      throw new Error('There is no ' + name + ', not enough version tags available, found ' + sortedVersionTags.length + ' tags: ' + availableTags);
    }

    return resolveNaming(tag.tag, gitP);
  } else {
    return gitP('rev-parse', '--short', name).trim();
  }
}

function filesInIndexAtRev(rev, gitP = git) {
  return [...lineSplit(gitP('ls-tree', '--name-only', '-r', rev))];
}

function createDiffStructure(oldName, newName) {
  const workingPath = pathUtils.resolve(workingDirName);

  const gitWorking = (...args) => gitDir(workingPath, ...args);

  // for commit the current version
  gitWorking('config', '--global', 'user.email', '"noreply@workflow.io"');
  gitWorking('config', '--global', 'user.name', '"Docker Workflow"');
  gitWorking('config', '--global', 'init.defaultBranch', '"main"');
  gitWorking('config', '--global', 'advice.detachedHead', 'false');
  gitWorking('config', '--global', 'core.autocrlf', 'input');
  gitWorking('config', '--global', 'core.safecrlf', 'false');

  const oldRef = resolveNaming(oldName, gitWorking);
  const oldTags = [...getTagsAtRev(oldRef, gitWorking)];
  console.log('Resolved previous name "' + oldName + '" to ref ' + oldRef + ' (' + oldTags.join(', ') + ')');

  const newRef = resolveNaming(newName, gitWorking);
  const newTags = [...getTagsAtRev(newRef, gitWorking)];
  console.log('Resolved current name "' + newName + '" to ref ' + newRef + ' (' + newTags.join(', ') + ')');

  fs.mkdirSync(previousFilesDirName, {recursive: true});
  const gitOld = (...args) => gitDir(previousFilesDirName, ...args);

  gitOld('init');
  gitOld('remote', 'add', 'origin', workingPath);
  gitOld('fetch', '--quiet', '--tags', '--all');
  console.log(gitOld('log', '--pretty=format:%h %d %s', '--all'));
  gitOld('checkout', oldRef);


  fs.mkdirSync(currentFilesDirName, {recursive: true});
  const gitNew = (...args) => gitDir(currentFilesDirName, ...args);

  gitNew('init');
  gitNew('remote', 'add', 'origin', workingPath);
  gitNew('fetch', '--quiet', '--tags', '--all');
  console.log(gitNew('log', '--pretty=format:%h %d %s', '--all'));
  gitNew('checkout', newRef);


  const filesOld = filesInIndexAtRev(oldRef, gitOld);
  const filesNew = filesInIndexAtRev(newRef, gitNew);

  const alreadyProcessedFiles = new Set();

  for (const file of [...filesOld, ...filesNew]) {
    if (!file.endsWith('.tex'))
      continue;

    if (alreadyProcessedFiles.has(file))
      continue;

    alreadyProcessedFiles.add(file);

    if (!filesOld.includes(file)) {
      const fullPath = pathUtils.resolve(previousFilesDirName, file);
      fs.mkdirSync(pathUtils.dirname(fullPath), {recursive: true});
      fs.writeFileSync(fullPath, '');
    }

    if (!filesNew.includes(file)) {
      const fullPath = pathUtils.resolve(currentFilesDirName, file);
      fs.mkdirSync(pathUtils.dirname(fullPath), {recursive: true});
      fs.writeFileSync(fullPath, '');
    }
  }

  let script = '#! /bin/bash\n';

  const paths = [...alreadyProcessedFiles.keys()].sort();

  const maxLength = paths.reduce((p, c) => Math.max(p, c.length), 0);

  for (const p of paths) {
    const frmP = (dir, p) => pathUtils.join(dir, p).padEnd(maxLength + dir.length + 1, ' ');

    script += '\n';
    script += 'mkdir -p ' + pathUtils.dirname(pathUtils.join(diffFilesDirName, p)) + '\n';

    const latexDiffOptions = '--exclude-safecmd=textquote';
    script += 'latexdiff ' + latexDiffOptions + ' ' + frmP(previousFilesDirName, p) + ' ' + frmP(currentFilesDirName, p) + ' > ' + frmP(diffFilesDirName, p) + '\n';
  }

  fs.writeFileSync(diffToDoPath, script, {mode: 0o777});

  const deltaNotationStr = (oldTags.join('_') || oldRef) + '-' + (newTags.join('_') || newRef);

  fs.writeFileSync(deltaNotation, deltaNotationStr, {mode: 0o666});

  fs.rmSync(workingDirName, {recursive: true});

  for (const dir of [previousFilesDirName, currentFilesDirName])
    fs.rmSync(pathUtils.join(dir, '.git'), {recursive: true});

  fs.rmSync(_script);
}


createDiffStructure(previousVersion, currentVersion);

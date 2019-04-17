import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

let _;

(function(_) {
  function handleResult(resolve, reject, error, result) {
    if (error) {
      reject(massageError(error));
    }
    else {
      resolve(result);
    }
  }

  function massageError(error) {
    if (error.code === 'ENOENT') {
      return vscode.FileSystemError.FileNotFound();
    }
    if (error.code === 'EISDIR') {
      return vscode.FileSystemError.FileIsADirectory();
    }
    if (error.code === 'EEXIST') {
      return vscode.FileSystemError.FileExists();
    }
    if (error.code === 'EPERM' || error.code === 'EACCESS') {
      return vscode.FileSystemError.NoPermissions();
    }
    return error;
  }

  function checkCancellation(token) {
    if (token.isCancellationRequested) {
      throw new Error('Operation cancelled');
    }
  }
  _.checkCancellation = checkCancellation;

  function normalizeNFC(items) {
    if (process.platform !== 'darwin') {
      return items;
    }
    if (Array.isArray(items)) {
      return items.map(item => item.normalize('NFC'));
    }
    return items.normalize('NFC');
  }
  _.normalizeNFC = normalizeNFC;

  function readdir(path) {
    return new Promise((resolve, reject) => {
      fs.readdir(path, (error, children) => {
        if (error) {
          resolve([]);
        } else {
          return handleResult(resolve, reject, error, normalizeNFC(children))
        }
      });
    });
  }
  _.readdir = readdir;

  function stat(path) {
    return new Promise((resolve, reject) => {
      fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
    });
  }
  _.stat = stat;

  function readfile(path) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, (error, buffer) => handleResult(resolve, reject, error, buffer));
    });
  }
  _.readfile = readfile;

  function writefile(path, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(path, content, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.writefile = writefile;

  function exists(path) {
    return new Promise((resolve, reject) => {
      fs.exists(path, exists => handleResult(resolve, reject, null, exists));
    });
  }
  _.exists = exists;

  function rmrf(path) {
    return new Promise((resolve, reject) => {
      rimraf(path, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.rmrf = rmrf;

  function mkdir(path) {
    return new Promise((resolve, reject) => {
      mkdirp(path, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.mkdir = mkdir;

  function rename(oldPath, newPath) {
    return new Promise((resolve, reject) => {
      fs.rename(oldPath, newPath, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.rename = rename;

  function unlink(path) {
    return new Promise((resolve, reject) => {
      fs.unlink(path, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.unlink = unlink;

  function copy(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
      fs.copyFile(sourcePath, destPath, error => handleResult(resolve, reject, error, void 0));
    });
  }
  _.copy = copy;

})(_ || (_ = {}));

export class FileStat {
  constructor(fsStat) {
    this.fsStat = fsStat;
  }
  get type() {
    return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
  }
  get isFile() {
    return this.fsStat.isFile();
  }
  get isDirectory() {
    return this.fsStat.isDirectory();
  }
  get isSymbolicLink() {
    return this.fsStat.isSymbolicLink();
  }
  get size() {
    return this.fsStat.size;
  }
  get ctime() {
    return this.fsStat.ctime.getTime();
  }
  get mtime() {
    return this.fsStat.mtime.getTime();
  }
}

export class NjwapProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
  }

  get onDidChangeTreeData() {
    return this._onDidChangeTreeData.event;
  }

  stat(uri) {
    return this._stat(uri.fsPath);
  }

  async _stat(path) {
    return new FileStat(await _.stat(path));
  }

  readDirectory(uri) {
    return this._readDirectory(uri);
  }

  async _readDirectory(uri) {
    const children = await _.readdir(uri.fsPath);
    const result = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const stat = await this._stat(path.join(uri.fsPath, child));
      result.push([child, stat.type]);
    }

    return Promise.resolve(result);
  }

  getIncludes() {
    if (!this.options.includes) {
      return false;
    }

    let first = [];
    let second = [];

    this.options.includes.forEach(item => {
      const value = item.split('/');

      if (value[0] && value[1]) {
        first.push(value[0]);
        second.push(value[1]);
      }
    });

    if (first.length > 0 && second.length > 0) {
      return {
        first,
        second
      };
    }
    else {
      return false;
    }
  }

  // tree data provider
  async getChildren(element) {
    this.options = vscode.workspace.getConfiguration('njwap-projects-tree-view');

    if (!this.options.wwwPath || !this.options.wwwProjectPath) {
      return [];
    }

    if (element) {
      if (element.depth === 1) {
        const currentPath = path.relative(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'html'), element.uri.path);

        return [
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'html', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'html',
            pathType: 'wwwProject'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_js', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_js',
            pathType: 'wwwProject'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_css', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_css',
            pathType: 'wwwProject'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_img', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_img',
            pathType: 'wwwProject'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwPath, 'njwap_server', 'controller', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'controller',
            pathType: 'www'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwPath, 'njwap_server', 'model', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'model',
            pathType: 'www'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'less', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'less',
            pathType: 'wwwProject'
          },
        ]
      }
      else if (element.depth > 1) {
        const children = await this.readDirectory(element.uri);

        children.sort((a, b) => {
          if (a[1] === b[1]) {
            return a[0].localeCompare(b[0]);
          }
          return a[1] === vscode.FileType.Directory ? -1 : 1;
        })

        return children.map(([name, type]) => ({
          uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
          type,
          depth: element.depth + 1
        }));
      }
      else {
        let children = await this.readDirectory(element.uri);

        children = children.filter(item => item[1] === vscode.FileType.Directory);

        let includes = this.getIncludes();

        if (includes !== false) {
          children = children.filter(item => includes.second.indexOf(item[0]) >= 0);
        }

        return children.map(([name, type]) => ({
          uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
          type,
          depth: element.depth + 1
        }));
      }
    }
    else {
      // 根级
      const workspaceFolder = {
        uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'html'))
      };

      let children = await this.readDirectory(workspaceFolder.uri);

      children = children.filter(item => item[1] === vscode.FileType.Directory);

      let includes = this.getIncludes();

      if (includes !== false) {
        children = children.filter(item => includes.first.indexOf(item[0]) >= 0);
      }

      children.sort((a, b) => {
        if (a[1] === b[1]) {
          return a[0].localeCompare(b[0]);
        }
        return 1;
      });

      return children.map(([name, type]) => ({
        uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)),
        type,
        depth: 0
      }));
    }
  }

  getTreeItem(element) {
    const treeItem = new vscode.TreeItem(element.uri, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

    if (element.label) {
      treeItem.label = element.label;
    }

    if (element.type === vscode.FileType.File) {
      treeItem.command = {
        command: 'njwap-projects-tree-view.openFile',
        title: "打开文件",
        arguments: [element.uri],
      };
      treeItem.contextValue = 'file';
    }
    else if (element.type === vscode.FileType.Directory) {
      if (element.depth == 2) {
        treeItem.contextValue = 'labelFolder';
      }
      else if (element.depth > 2) {
        treeItem.contextValue = 'folder';
      }
    }

    return treeItem;
  }
}

export class NjwapExplorer {
  constructor(ctx) {
    this.treeDataProvider = new NjwapProvider();

    this.ctx = ctx;
    this.instance = vscode.window.createTreeView('njwapProjects', {
      showCollapseAll: true,
      treeDataProvider: this.treeDataProvider
    });

    vscode.commands.registerCommand('njwap-projects-tree-view.openFile', (resource) => this.openResource(resource));
    vscode.commands.registerCommand('njwap-projects-tree-view.refresh', () => {
      this.treeDataProvider._onDidChangeTreeData.fire();
    });
    vscode.commands.registerCommand('njwap-projects-tree-view.createFolder', (element) => this.createFolder(element));
    vscode.commands.registerCommand('njwap-projects-tree-view.createFile', (element) => this.createFile(element));
    vscode.commands.registerCommand('njwap-projects-tree-view.rename', (element) => this.rename(element));
    vscode.commands.registerCommand('njwap-projects-tree-view.remove', (element) => this.remove(element));
    vscode.commands.registerCommand('njwap-projects-tree-view.importFile', (element) => this.importFile(element));
  }

  openResource(resource) {
    vscode.commands.executeCommand('vscode.open', resource, {
      preview: false
    });
  }

  async createFolder(element) {
    let currentPath;

    if (element.label) {
      if (element.pathType === 'wwwProject') {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src', element.label), element.uri.path);
      }
      else {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwPath, 'njwap_server', element.label), element.uri.path);
      }
    }
    else {
      if (element.uri.path.indexOf(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src')) === 0) {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src'), element.uri.path);
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src', currentPath.split(path.sep)[0]), element.uri.path);
        currentPath = currentPath.split(path.sep).slice(0, 2).join(path.sep);
      }
      else {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwPath, 'njwap_server'), element.uri.path);
      }
    }

    const result = await vscode.window.showInputBox({
      prompt: `项目: ${currentPath}`,
      placeHolder: `在 ${element.label || path.basename(element.uri.path)} 中新建文件夹`
    });

    if (!result) {
      return;
    }

    await _.mkdir(path.join(element.uri.path, result));

    this.treeDataProvider._onDidChangeTreeData.fire();
  }

  async createFile(element) {
    let currentPath;

    if (element.label) {
      if (element.pathType === 'wwwProject') {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src', element.label), element.uri.path);
      }
      else {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwPath, 'njwap_server', element.label), element.uri.path);
      }
    }
    else {
      if (element.uri.path.indexOf(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src')) === 0) {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src'), element.uri.path);
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwProjectPath, 'njwap', 'src', currentPath.split(path.sep)[0]), element.uri.path);
        currentPath = currentPath.split(path.sep).slice(0, 2).join(path.sep);
      }
      else {
        currentPath = path.relative(path.join(this.treeDataProvider.options.wwwPath, 'njwap_server'), element.uri.path);
      }
    }

    const result = await vscode.window.showInputBox({
      prompt: `项目: ${currentPath}`,
      placeHolder: `在 ${element.label || path.basename(element.uri.path)} 中新建文件`
    });

    if (!result) {
      return;
    }

    await _.writefile(path.join(element.uri.path, result), '');

    this.treeDataProvider._onDidChangeTreeData.fire();
  }

  async rename(element) {
    const result = await vscode.window.showInputBox({
      value: path.basename(element.uri.path),
      valueSelection: [0, path.basename(element.uri.path).lastIndexOf('.')]
    });

    await _.rename(element.uri.path, path.join(path.dirname(element.uri.path), result));

    this.treeDataProvider._onDidChangeTreeData.fire();
  }

  async remove(element) {
    const result = await vscode.window.showInformationMessage(`确认要删除 ${path.basename(element.uri.path)} 吗？`, { title: '确认' }, { title: '取消' });

    if (result && result.title === '确认') {
      await _.rmrf(element.uri.path);

      this.treeDataProvider._onDidChangeTreeData.fire();
    }
  }

  async importFile(element) {
    const result = await vscode.window.showOpenDialog({
      canSelectMany: true
    });

    if (!result) {
      return;
    }

    result.forEach(async (item) => {
      const filename = path.basename(item.path);

      await _.copy(item.path, path.join(element.uri.path, filename))
    });

    this.treeDataProvider._onDidChangeTreeData.fire();
  }
}

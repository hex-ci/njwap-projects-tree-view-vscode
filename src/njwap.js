import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';

//#region Utilities
let _;
(function(_) {
  function handleResult(resolve, reject, error, result) {
    if (error) {
      reject(massageError(error));
    } else {
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
        }
        else {
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

//#endregion
export class NjwapProvider {
  constructor() {
    this.options = vscode.workspace.getConfiguration('njwap-projects-tree-view');

    this._onDidChangeFile = new vscode.EventEmitter();
  }

  get onDidChangeFile() {
    return this._onDidChangeFile.event;
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

  // tree data provider
  async getChildren(element) {
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
            label: 'html'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_js', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_js'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_css', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_css'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'cdn_img', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'cdn_img'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwPath, 'njwap_server', 'controller', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'controller'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwPath, 'njwap_server', 'model', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'model'
          },
          {
            uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'less', currentPath)),
            type: vscode.FileType.Directory,
            depth: element.depth + 1,
            label: 'less'
          },
        ]
      }
      else if (element.depth > 1) {
        const children = await this.readDirectory(element.uri);

        return children.map(([name, type]) => ({
          uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
          type,
          depth: element.depth + 1
        }));
      }
      else {
        let children = await this.readDirectory(element.uri);

        children = children.filter(item => item[1] === vscode.FileType.Directory);

        return children.map(([name, type]) => ({
          uri: vscode.Uri.file(path.join(element.uri.fsPath, name)),
          type,
          depth: element.depth + 1
        }));
      }
    }
    else {
      const workspaceFolder = {
        uri: vscode.Uri.file(path.join(this.options.wwwProjectPath, 'njwap', 'src', 'html'))
      };

      let children = await this.readDirectory(workspaceFolder.uri);

      children = children.filter(item => item[1] === vscode.FileType.Directory);

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
        title: "Open File",
        arguments: [element.uri],
      };
      treeItem.contextValue = 'file';
    }

    return treeItem;
  }
}

export class NjwapExplorer {
  constructor(ctx) {
    const treeDataProvider = new NjwapProvider();

    this.ctx = ctx;
    this.instance = vscode.window.createTreeView('njwapProjects', {
      treeDataProvider
    });

    vscode.commands.registerCommand('njwap-projects-tree-view.openFile', (resource) => this.openResource(resource));
    vscode.commands.registerCommand('njwap-projects-tree-view.refresh', () => {
      console.log('refresh');
    });
  }

  openResource(resource) {
    vscode.commands.executeCommand('vscode.open', resource, { preview: false });
  }
}

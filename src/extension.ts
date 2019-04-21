import * as vscode from 'vscode';
import { spawn } from 'child-process-promise';

const runningDaemons = new Set<vscode.Uri>();
const diagnostics = new Map<vscode.Uri, vscode.DiagnosticCollection>();
const outputChannel = vscode.window.createOutputChannel('Mypy');
let _context: vscode.ExtensionContext | null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	_context = context;
	context.subscriptions.push(outputChannel);
	
	if (vscode.workspace.workspaceFolders) {
		await Promise.all(vscode.workspace.workspaceFolders.map(folder => startDaemonAndCheckWorkspace(folder.uri)));
	}
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(workspaceFoldersChanged));
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(documentSaved));
}

export async function deactivate(): Promise<void> {
	let daemonStopPromises = Array.from(runningDaemons).map(folder => stopDaemon(folder));
	await Promise.all(daemonStopPromises);
}

function workspaceFoldersChanged(e: vscode.WorkspaceFoldersChangeEvent): void {
	e.added.forEach(folder => startDaemonAndCheckWorkspace(folder.uri));
	e.removed.forEach(folder => stopDaemon(folder.uri));
}

async function startDaemon(folder: vscode.Uri): Promise<boolean> {
	outputChannel.appendLine(`Start daemon: ${folder.fsPath}`);
	const result = await runDmypy(folder, ['restart', '--', '--follow-imports=skip']);
	if (result.success) {
		runningDaemons.add(folder);
	}
	return result.success;
}

async function startDaemonAndCheckWorkspace(folder: vscode.Uri): Promise<void> {
	const daemonStarted = await startDaemon(folder);
	if (daemonStarted) {
		checkWorkspace(folder);
	}
}

async function stopDaemon(folder: vscode.Uri): Promise<void> {
	outputChannel.appendLine(`Stop daemon: ${folder.fsPath}`);
	if (!runningDaemons.has(folder)) {
		outputChannel.appendLine(`Daemon not running.`);
		return;
	}
	
	const result = await runDmypy(folder, ['stop']);
	if (result.success) {
		runningDaemons.delete(folder);
	}
}

async function runDmypy(folder: vscode.Uri, args: string[], successfulExitCodes?: number[]):
		Promise<{success: boolean, stdout: string | null}> {
	const config = vscode.workspace.getConfiguration('python', folder);
	const pythonPath = config.pythonPath || 'python';

	try {
		const result = await spawn(
			pythonPath,
			['-m', 'mypy.dmypy'].concat(args),
			{
				cwd: folder.fsPath,
				capture: ['stdout', 'stderr'],
				successfulExitCodes
			}
		);
		return {success: true, stdout: result.stdout};
	} catch (ex) {
		outputChannel.appendLine(ex.toString());
		if (ex.name === 'ChildProcessError') {
			if (ex.stdout) {
				outputChannel.appendLine(`stdout:\n${ex.stdout}`);
			}
			if (ex.stderr) {
				outputChannel.appendLine(`stderr:\n${ex.stderr}`);
			}
		}
		return {success: false, stdout: null};
	}
}

function documentSaved(document: vscode.TextDocument): void {
	const folder = vscode.workspace.getWorkspaceFolder(document.uri);
	if (!folder) {
		return;
	}
	checkWorkspace(folder.uri);
}

async function checkWorkspace(folder: vscode.Uri) {
	const result = await runDmypy(folder, ['check', '--', '.'], [0, 1]);
	if (result.success) {
		const diagnostics = getWorkspaceDiagnostics(folder);
		diagnostics.clear();
		const someFile = folder.with({path: folder.path + '/a.py'})
		const someDiagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 3, 0, 12),
			'Something is terribly wrong');
		diagnostics.set(someFile, [someDiagnostic]);
	}
}

function getWorkspaceDiagnostics(folder: vscode.Uri): vscode.DiagnosticCollection {
	let workspaceDiagnostics = diagnostics.get(folder);
	if (workspaceDiagnostics) {
		return workspaceDiagnostics;
	} else {
		const workspaceDiagnostics = vscode.languages.createDiagnosticCollection('mypy');
		diagnostics.set(folder, workspaceDiagnostics);
		_context!.subscriptions.push(workspaceDiagnostics);
		return workspaceDiagnostics;
	}
}
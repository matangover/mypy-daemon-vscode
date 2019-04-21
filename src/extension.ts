import * as vscode from 'vscode';
import { spawn } from 'child-process-promise';

const runningDaemons = new Set<vscode.Uri>();
const outputChannel = vscode.window.createOutputChannel('Mypy');

export function activate(context: vscode.ExtensionContext) {
	
	if (vscode.workspace.workspaceFolders) {
		vscode.workspace.workspaceFolders.forEach(folder => startDaemon(folder.uri));
	}
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(workspaceFoldersChanged));
	context.subscriptions.push(outputChannel);
}

export async function deactivate(): Promise<void> {
	let daemonStopPromises = Array.from(runningDaemons).map(folder => stopDaemon(folder));
	await Promise.all(daemonStopPromises);
}

function workspaceFoldersChanged(e: vscode.WorkspaceFoldersChangeEvent) {
	e.added.forEach(folder => startDaemon(folder.uri));
	e.removed.forEach(folder => stopDaemon(folder.uri));
}

async function startDaemon(folder: vscode.Uri): Promise<void> {
	outputChannel.appendLine(`Start daemon: ${folder.fsPath}`);
	if (await runDmypy(folder, ['restart', '--', '--follow-imports=skip'])) {
		runningDaemons.add(folder);
	}
}

async function stopDaemon(folder: vscode.Uri): Promise<void> {
	outputChannel.appendLine(`Stop daemon: ${folder.fsPath}`);
	if (!runningDaemons.has(folder)) {
		outputChannel.appendLine(`Daemon not running.`);
		return;
	}
	
	if(await runDmypy(folder, ['stop'])) {
		runningDaemons.delete(folder);
	}
}

async function runDmypy(folder: vscode.Uri, args: string[]): Promise<boolean> {
	const config = vscode.workspace.getConfiguration('python', folder);
	const pythonPath = config.pythonPath || 'python';

	try {
		await spawn(
			pythonPath,
			['-m', 'mypy.dmypy'].concat(args),
			{cwd: folder.fsPath, capture: ['stdout', 'stderr']});
		return true;
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
		return false;
	}
}
# mypy

Analyze and typecheck your Python code using mypy.

## Features

This extension runs the [mypy daemon](https://mypy.readthedocs.io/en/latest/mypy_daemon.html) to analyze your entire Python workspace, and emits diagnostics and errors reported by mypy. Analyzing the entire workspace is better than running mypy on each file separately, because this way mypy is able to infer types between modules.

The workspace is re-checked every time a file is saved. This is fast because mypy caches program state in memory and doesn't need to re-analyze files that haven't changed.

## Requirements

You must install Python and mypy to use this extension. 

## Extension Settings
The extension will use the interpreter specified in your `python.pythonPath` setting to run mypy. Mypy must be installed for that interpreter.

## Release Notes

### 0.0.1

Initial release.

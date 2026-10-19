
import { useState } from 'react';
import Editor from '@monaco-editor/react';

const initialFiles = {
  'script.js': {
    language: 'javascript',
    value: '// Start coding here\n'
  }
};

function getLanguage(filename) {
  const extension = filename.split('.').pop().toLowerCase();

  const languages = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    css: 'css',
    json: 'json',
    py: 'python',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    sql: 'sql',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    go: 'go',
    rs: 'rust'
  };

  return languages[extension] || 'plaintext';
}

export default function App() {
  const [files, setFiles] = useState(initialFiles);
  const [activeFile, setActiveFile] = useState('script.js');

  const file = files[activeFile];

  function createFile() {
    let name = prompt('Enter filename:');

    if (!name) return;

    name = name.trim();

    if (!name) return;

    if (!name.includes('.')) {
      name += '.js';
    }

    if (files[name]) {
      alert('File already exists');
      return;
    }

    setFiles(previous => ({
      ...previous,
      [name]: {
        language: getLanguage(name),
        value: ''
      }
    }));

    setActiveFile(name);
  }

  function handleChange(value) {
    setFiles(previous => ({
      ...previous,
      [activeFile]: {
        ...previous[activeFile],
        value: value ?? ''
      }
    }));
  }

  return (
    <div style={{
      background: '#1e1e1e',
      color: '#fff',
      minHeight: '100vh',
      padding: '12px'
    }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button onClick={createFile}>+ New File</button>

        {Object.keys(files).map(name => (
          <button
            key={name}
            disabled={activeFile === name}
            onClick={() => setActiveFile(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <Editor
        height="85vh"
        theme="vs-dark"
        path={activeFile}
        language={file.language}
        value={file.value}
        onChange={handleChange}
      />
    </div>
  );
}

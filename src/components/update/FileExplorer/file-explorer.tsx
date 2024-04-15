import React from "react";
import "./file-explorer.css";
interface File {
  kind: string;
  name: string;
}

interface Props {
  files: File[];
  openFile: (file: File) => void;
}

const FileExplorer: React.FC<Props> = ({ files, openFile }) => {
  return (
    <div>
      <div className="top-bar">
        <span className="material-symbols-outlined">chevron_left</span>
        <span className="material-symbols-outlined">chevron_right</span>
        <span className="folder">root</span>
      </div>
      <div>
        {files.map((file: File) => (
          <div className="row" key={file.name}>
            {file.kind === "directory" ? (
              <span className="material-symbols-outlined">folder</span>
            ) : (
              <span className="material-symbols-outlined">draft</span>
            )}
            <a
              onClick={() => {
                openFile(file);
              }}
            >
              {file.name}
            </a>
            <br />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;

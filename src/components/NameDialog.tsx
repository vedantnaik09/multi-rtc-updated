import React, { useState, useEffect, useRef } from 'react';

interface NameDialogProps {
  setMyName: (name: string) => void;
}

const NameDialog: React.FC<NameDialogProps> = ({ setMyName }) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [showDialog, setShowDialog] = useState<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if a name is already stored in session storage
    const storedName = sessionStorage.getItem('userName');
    if (storedName) {
      setMyName(storedName);
      setShowDialog(false);
    }
  }, [setMyName]);

  useEffect(() => {
    if (showDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showDialog]);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      // Store the name in session storage
      sessionStorage.setItem('userName', inputValue);
      setMyName(inputValue); // This updates the parent's state
      setShowDialog(false);
    }
  };

  if (!showDialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-bold mb-4">Enter your name</h2>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          ref={inputRef}
          className="border border-gray-300 rounded w-full p-2 mb-4"
          placeholder="Type your name"
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default NameDialog;

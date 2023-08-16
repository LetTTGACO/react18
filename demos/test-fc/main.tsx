import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <span>
        <Child />
      </span>
    </div>
  );
}

function Child() {
  return <span>Child </span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

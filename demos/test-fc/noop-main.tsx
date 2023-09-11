import React from 'react';
import ReactDOM from 'react-noop-renderer';

function App() {
  return (
    <>
      <Child />
      <div>Hello world</div>
    </>
  );
}

function Child() {
  // return <span>Child </span>;
  return 'Child';
}

const root = ReactDOM.createRoot();

root.render(<App />);
window.root = root;

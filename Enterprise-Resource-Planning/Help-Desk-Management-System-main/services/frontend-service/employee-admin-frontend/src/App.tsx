import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';

const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={AdminPanel} />
      </Switch>
    </Router>
  );
};

export default App;
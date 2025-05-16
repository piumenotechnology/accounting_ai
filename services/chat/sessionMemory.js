const memory = {};

function getContext(session_id) {
  if (!memory[session_id]) {
    memory[session_id] = { lastQuery: '', context: {} };
  }
  return memory[session_id];
}

function updateContext(session_id, context = {}) {
  const session = getContext(session_id);
  session.context = {
    ...session.context,
    ...context
  };
}

module.exports = {
  getContext,
  updateContext
};

function write(method, message, context) {
  if (context === undefined) {
    method(message);
    return;
  }

  method(message, JSON.stringify(context, null, 2));
}

function info(message, context) {
  write(console.log, message, context);
}

function error(message, context) {
  write(console.error, message, context);
}

module.exports = { info, error };

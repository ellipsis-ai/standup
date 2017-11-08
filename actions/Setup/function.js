function(channel, whenToAsk, whenToDisplaySummary, ellipsis) {
  const EllipsisApi = require('ellipsis-api');
const api = new EllipsisApi(ellipsis).actions;

function unscheduleAction(actionName) {
  return api.unschedule({
    actionName: actionName,
    channel: channel.trim()
  });
}

function scheduleAction(actionName, timeOfDay, useDM) {
  const recurrence = `every weekday at ${timeOfDay}`;
  return api.schedule({
    actionName: actionName,
    args: [{ name: "channel", value: channel }],
    channel: channel.trim(),
    recurrence: recurrence,
    useDM: useDM
  });
}

function setUpAction(action, newTimeOfDay, useDM) {
  return unscheduleAction(action).then(() => {
    return scheduleAction(action, newTimeOfDay, useDM)
  });
}

let askRecurrence, summaryRecurrence;
setUpAction("Check standup status", whenToAsk, true).then((resp) => {
  askRecurrence = resp.scheduled ? resp.scheduled.recurrence : null;
  return setUpAction("Standup status summary", whenToDisplaySummary, false);
}).then((resp) => {
  summaryRecurrence = resp.scheduled ? resp.scheduled.recurrence : null;
  ellipsis.success(
`OK, I’ve set everything up.

${askRecurrence ? `- I’ll send standup questions to each member of ${channel} ${askRecurrence}` : ""}
${summaryRecurrence ? `- I’ll report the results ${summaryRecurrence}.` : ""}`
  );
});
}

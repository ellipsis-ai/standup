function(channel, ellipsis) {
  const moment = require('moment-timezone');
const ActionLogs = require('action-logs')(ellipsis);
const NO_RESPONSE = "_(no response yet)_";
const todayStart = moment().tz(ellipsis.teamInfo.timeZone).startOf('day');

function whenFor(timestamp) {
  const inZone = moment(timestamp).tz(ellipsis.teamInfo.timeZone);
  if (inZone.isAfter(todayStart)) {
    return inZone.format('h:mma');
  } else {
    return inZone.format('h:mma on MMMM Do');
  }
}

ActionLogs.logsFor('Check standup status', null, null, null, 'scheduled').then(allQuestionLogs => {
  const askedByUser = ActionLogs.mostRecentPerUserInChannel(allQuestionLogs, channel);
  ActionLogs.logsFor('Answer status questions').then(allAnswerLogs => {
    const answered = ActionLogs.mostRecentPerUserInChannel(allAnswerLogs, channel);
    const results = ActionLogs.filterAnswersAfterLastAsked(answered, askedByUser);
    const answeredResults = results.map(ea => {
      return {
        user: ea.user,
        today: (ea.today ? ea.today : NO_RESPONSE),
        when: whenFor(ea.timestamp)
      };
    });
    const slackers = askedByUser.filter(eaAsked => {
      return results.findIndex(eaAnswered => eaAnswered.user === eaAsked.user) === -1;
    }).map(ea => ea.user);
    ellipsis.success({
      answeredResults: answeredResults,
      slackers: slackers,
      hasSlackers: slackers.length > 0,
      nobodyWasAsked: askedByUser.length === 0,
      timeZone: moment().tz(ellipsis.teamInfo.timeZone).format("z")
    });
  });
});
}

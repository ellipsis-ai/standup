function(channel, ellipsis) {
  const moment = require('moment-timezone');
const ActionLogs = require('action-logs')(channel, ellipsis);
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
 
ActionLogs.questionLogs().then(askedByUser => {
  ActionLogs.answerLogs().then(answered => {
    const results = ActionLogs.filterAnswersAfterLastAsked(answered, askedByUser);
    const answeredResults = results.map(ea => {
      return {
        user: ea.user,
        yesterday: (ea.yesterday ? ea.yesterday : NO_RESPONSE),
        today: (ea.today ? ea.today : NO_RESPONSE),
        today2: (ea.today2 ? ea.today2 : NO_RESPONSE),
        blockers: (ea.blockers ? ea.blockers : NO_RESPONSE),
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

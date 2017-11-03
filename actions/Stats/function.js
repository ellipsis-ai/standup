function(ellipsis) {
  const moment = require('moment-timezone');
const ActionLogs = require('action-logs')(null, ellipsis);

let numChannels = 0;
let numUsersAsked = 0;
let numUsersAnswered = 0;
let standupMoments = [];

ActionLogs.summaryLogs().then(summaryByChannel => {
  numChannels = summaryByChannel.length;
  standupMoments = summaryByChannel.map((ea) => moment(ea.timestamp).tz(ellipsis.teamInfo.timeZone));
  Promise.all(summaryByChannel.map((summary) => {
    const summaryMoment = moment(summary.timestamp).tz(ellipsis.teamInfo.timeZone);
    const summaryTime = summaryMoment.toDate();
    const startBeforeSummary = summaryMoment.subtract(4, 'days').toDate();
    return ActionLogs.questionLogs(null, startBeforeSummary, summaryTime)
      .then(rawAskedByUser => {
        const askedByUser = rawAskedByUser.filter((ea) => ea.channel === summary.channel);
        numUsersAsked += askedByUser.length;
        return ActionLogs.answerLogs(null, startBeforeSummary, summaryTime).then((rawAnswered) => {
          const answered = rawAnswered.filter((ea) => ea.channel === summary.channel);
          const results = ActionLogs.filterAnswersAfterLastAsked(answered, askedByUser);
          numUsersAnswered += results.length;
        });
      });
  })).then(() => {
    const completionRate = (numUsersAnswered / numUsersAsked * 100).toFixed(1);
    const firstStandup = moment.min(standupMoments);
    const lastStandup = moment.max(standupMoments);
    let dateRange = "";
    if (firstStandup && firstStandup.isSame(lastStandup, 'day')) {
      dateRange = ` (${firstStandup.format("MMMM D")})`;
    } else if (firstStandup && lastStandup) {
      dateRange = ` (${firstStandup.format("MMMM D")} - ${lastStandup.format("MMMM D")})`;
    }
    const response = numUsersAsked > 0 ? `
**Stats for the most recent completed ${numChannels === 1 ? "standup" : "standups"}${dateRange}:**
- ${
  numUsersAsked === 1 ? "1 participant" : `${numUsersAsked} participants`
} ${
  numChannels === 1 ? "in 1 channel" : `across ${numChannels} channels`
}
- ${
  numUsersAnswered === 1 ? `1 complete response` : `${numUsersAnswered} complete responses`
} before the ${
  numChannels === 1 ? "summary was posted" : "summaries were posted"
}
- ${completionRate}% completion rate
` : "No standup has run recently.";
    ellipsis.success(response);    
  });
});
}

function summarizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function createGoalDrivenAgent(definition) {
  return {
    name: definition.name,
    skill: definition.skill,
    async run({ state, services }) {
      const maxCycles = definition.maxCycles || state.config.agentSystem?.maxCyclesPerAgent || 2;
      const plans = [];
      const replans = [];
      const executionSnapshots = [];
      let workingMemory = {};
      let lastExecution = null;
      let lastCredibility = null;
      let goalCheck = { passed: true, reason: "No explicit goal gate provided." };

      try {
        if (definition.goalCheck) {
          goalCheck = await definition.goalCheck({ state, services, workingMemory });
        }

        if (!goalCheck.passed) {
          return {
            agent: definition.name,
            skill: definition.skill,
            status: "skipped",
            goalCheck,
            plans,
            replans,
            credibility: { passed: true, score: 1, notes: ["Goal gate skipped execution."] },
            output: definition.emptyOutput ? definition.emptyOutput({ state }) : null
          };
        }

        let cycle = 0;
        while (cycle < maxCycles) {
          cycle += 1;
          const plan = definition.plan
            ? await definition.plan({ state, services, workingMemory, attempt: cycle })
            : { steps: ["Execute assigned work."] };
          plans.push(plan);

          lastExecution = await definition.execute({ state, services, workingMemory, plan, attempt: cycle });
          executionSnapshots.push(lastExecution.summary || lastExecution);

          if (lastExecution.workingMemoryPatch) {
            workingMemory = { ...workingMemory, ...lastExecution.workingMemoryPatch };
          }

          if (lastExecution.replanRequired && cycle < maxCycles && definition.replan) {
            const replan = await definition.replan({
              state,
              services,
              workingMemory,
              attempt: cycle,
              execution: lastExecution
            });
            replans.push(replan);
            if (replan.workingMemoryPatch) {
              workingMemory = { ...workingMemory, ...replan.workingMemoryPatch };
            }
            continue;
          }

          lastCredibility = definition.credibilityCheck
            ? await definition.credibilityCheck({
                state,
                services,
                workingMemory,
                execution: lastExecution,
                attempt: cycle
              })
            : { passed: true, score: 1, notes: ["No credibility check defined."] };

          if (lastCredibility.passed || cycle >= maxCycles || !definition.replan) {
            break;
          }

          const replan = await definition.replan({
            state,
            services,
            workingMemory,
            attempt: cycle,
            execution: lastExecution,
            credibility: lastCredibility
          });
          replans.push(replan);
          if (replan.workingMemoryPatch) {
            workingMemory = { ...workingMemory, ...replan.workingMemoryPatch };
          }
        }

        return {
          agent: definition.name,
          skill: definition.skill,
          status: lastCredibility?.passed === false ? "needs-review" : "completed",
          goalCheck,
          plans,
          replans,
          execution: executionSnapshots,
          credibility: lastCredibility || { passed: true, score: 1, notes: [] },
          output: lastExecution?.output ?? null,
          notes: lastExecution?.notes || []
        };
      } catch (error) {
        return {
          agent: definition.name,
          skill: definition.skill,
          status: "failed",
          goalCheck,
          plans,
          replans,
          credibility: { passed: false, score: 0, notes: [summarizeError(error)] },
          output: null,
          notes: [summarizeError(error)]
        };
      }
    }
  };
}

module.exports = { createGoalDrivenAgent };

const core = require('@actions/core');
const axios = require("axios");
const TESTINIUM_API_URL = "https://testinium.io/Testinium.RestApi/api";


async function run() {
    try {
       const apiUrl = core.getInput("api-url"),
            username = core.getInput("username"),
            password = core.getInput("password"),
            planName = core.getInput("plan-name"),
            testiniumToken = core.getInput("token"),
            time = (new Date()).toTimeString();
        const token = await login(username, password, testiniumToken);
        const plan = await start(planName, token);
        checkStatus(plan.id, token, plan.executionId);
    } catch (error) {
        core.setFailed(error.message);
    }
}



async function login(username, password,basicToken) {
    const res =  await axios.post(`https://account.testinium.com/uaa/oauth/token?grant_type=password&username=${username}&password=${password}`,null,{
        headers: {
            Authorization: basicToken
        }
    }).catch(err => {
        core.setFailed(`Error while login  ${err.response && err.response.data ? err.response.data.message : err.message}`)
        core.debug("ERROR in LOGIN", err.message);
    });
    return res.data.access_token
}

async function start(planName,token){
    const plans = await axios.get(`${TESTINIUM_API_URL}/plans/filter?page=1&size=20`, {
        headers: {
            Authorization:`Bearer ${token}`
        }
    }).catch(err => {
        core.setFailed(`Error while getting plans  ${err.response && err.response.data ? err.response.data.message : err.message}`)
        core.debug("ERROR in GET PLANS", err.message);
    });
    core.debug("Plans were fetched successfully.");
    const plan = plans.data.item_list.find(x => x.plan_name == planName);
    const executionDataRes = await axios.get(`${TESTINIUM_API_URL}/plans/${plan.id}/run`,{
        headers: {
            Authorization:`Bearer ${token}`
        }
    }).catch(err => {
        core.setFailed(`Error while start run ${err.response && err.response.data ? err.response.data.message  : err.message}`)
        core.debug("ERROR in START RUN", err.message);
    });
    core.debug("Plan was started successfully. " + JSON.stringify(executionDataRes.data));
    return { ...plan, executionId: executionDataRes.data.execution_id };
}

function checkStatus(id, token, executionId) {
    core.debug("Checking status...");
    setTimeout(async () => {
        const res = await axios.get(`${TESTINIUM_API_URL}/plans/${id}/checkIsRunning`, {
            headers: {
                Authorization:`Bearer ${token}`
            }
        }).catch(err => {
            core.setFailed(`Error while checking status  ${err.response && err.response.data ? err.response.data.message : err.message}`)
            core.debug("ERROR in CHECK STATUS", err.message);
        });
        if (res.data.running) {
            core.debug("Not finished yet.");
            checkStatus(...arguments);
        }
        else{
            core.info("Execution of plan is ended!");
            await getResult(executionId, token);

        }
    }, 10000)
}

async function getResult(executionId, token) {
    const res = await axios.get(`${TESTINIUM_API_URL}/executions/${executionId}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    }).catch(err => {
        core.setFailed(`Error while getting result of the execution  ${err.response && err.response.data ? err.response.data.message : err.message}`)
        console.log("ERROR in GET RESULT", err.message);
    });

    core.debug("The result of execution was fetched successfully.");
    if (res.data.result_summary && res.data.result_summary.FAILURE > 0){
        core.setFailed(`Execution of test plan was not successful. ${res.data.test_result_status_counts}`)
    }
}

run();
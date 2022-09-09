import * as core from '@actions/core'
import * as github from '@actions/github'
import {wait} from './wait'

type ActionInput = {
    token: string,
}

function getInputs(): ActionInput {
    const token = core.getInput('github-token', {required: true})

    return {
	token
    }
}

async function run(): Promise<void> {
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.token);
    const event = github.event;
    const context = github.context;

    console.log(event['before']);
    console.log(event['after']);
}

run()

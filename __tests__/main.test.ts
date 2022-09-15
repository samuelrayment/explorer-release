let commitResponses: CompareResponse[] = [];

var mockIterator = jest.fn().mockReturnValue({
    async *[Symbol.asyncIterator]() {
        let response = commitResponses.shift()
        while (response !== undefined) {
            yield response
            response = commitResponses.shift()
        }
    }
}); 

var mockGetOctokit = jest.fn().mockReturnValue({
    paginate: {
        iterator: mockIterator
    }
});
    
jest.mock('@actions/github', () => {
  return {
    context: {
      repo: {
        owner: 'owner',
        repo: 'repo'
      }
    },
    getOctokit: mockGetOctokit
  }
});
jest.mock("@actions/http-client");

import {expect, test} from '@jest/globals'
import { processPushEvent, ActionInput, MinimalPushEvent, CompareResponse } from '../src/main'
import { setInput } from '../src/utils/testUtils'
import * as core from "@actions/core";
import * as http from "@actions/http-client";

afterEach(() => {
    commitResponses = [];
    jest.restoreAllMocks();
});

function addCommitToResponse(sha: string, date: string) {
    commitResponses.push({
	data: {
	    commits: [{
		commit: {
		    author: {
			date: date,
		    },
		    url: `https://api.github.com/repos/owner/repo/git/commits/${sha}`
		}
	    }]
	}
    });
}

test('should post commits when action fires on push', async() => {
    const client = new http.HttpClient();
    const event: MinimalPushEvent = {
	before: "before-ref",
	after: "head-ref",
	pushed_at: 1663057197
    };
    const endpoint = 'http://endpoint.com/web-hook'
    setInput('github-token', 'fake-token');
    setInput('explorer-endpoint', endpoint);
    setInput('secret-key', 'secret-key');    
    addCommitToResponse("first-sha", "2022-09-12T09:00:00+01:00");
    addCommitToResponse("second-sha", "2022-09-12T09:10:00+01:00");
    
    await processPushEvent(event, client);

    expect(mockGetOctokit).toHaveBeenCalledWith('fake-token');
    expect(mockIterator).toHaveBeenCalledWith(
    	'GET /repos/{owner}/{repo}/compare/{basehead}',
    	{
    	    owner: 'owner',
    	    repo: 'repo',
    	    basehead: 'before-ref...head-ref',
    	    per_page: 100
    	}
    );
    let expectedBody = {			
	commits: [
          { committedAt: "2022-09-12T09:00:00+01:00", sha: 'first-sha' },
          { committedAt: "2022-09-12T09:10:00+01:00", sha: 'second-sha' }
	],
	pushedAt: "2022-09-13T09:19:57+01:00",
	sha: 'head-ref'
    };
    expect(client.post).toHaveBeenCalledWith(
	endpoint,
	JSON.stringify(expectedBody),
	{
	    'Content-Type': 'application/json'
	}
    );
})

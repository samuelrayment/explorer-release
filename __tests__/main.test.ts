import {expect, test} from '@jest/globals'
import { processPushEvent, ActionInput, MinimalPushEvent } from '../src/main'
import { setInput } from '../src/utils/testUtils'
import * as core from "@actions/core";
import * as github from '@actions/github'

let commitResponses: CompareResponse[] = [];
let mockGetOctokit: any = null;
const iterator: any = {
    async *[Symbol.asyncIterator]() {
	let response = commitResponses.shift();
	while (response !== undefined) {
	    yield response;
	    response = commitResponses.shift();
	}
    }
};
const mockOctokit: any = {
    paginate: {
	iterator: jest.fn().mockReturnValue(iterator)
    }
};

beforeAll(() => {
    // works
    //mockGetOctokit = jest.spyOn(github, 'getOctokit').mockImplementation(jest.fn().mockReturnValue(mockOctokit));
    // doesn't
    jest.mock("@actions/github", () => {
	return {
	    context: {
		repo: {
		    owner: 'owner',
		    repo: 'repo'
		}
	    },
	    getOctokit: jest.fn().mockReturnValue(mockOctokit)
	}	    
    });
});

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
    const event: MinimalPushEvent = {
	before: "before-ref",
	after: "after-ref",
	pushed_at: 12102323
    };
    setInput('github-token', 'fake-token');
    addCommitToResponse("first-sha", "2022-09-12T09:00:00");
    addCommitToResponse("second-sha", "2022-09-12T09:10:00");
    
    await processPushEvent(event);
    
    expect(mockGetOctokit).toHaveBeenCalledWith('fake-token');
    expect(mockOctokit.paginate.iterator).toHaveBeenCalledWith(
	'GET /repos/{owner}/{repo}/compare/{basehead}',
	{
	    owner: 'owner',
	    repo: 'repo',
	    basehead: 'base-ref...after-ref',
	    per_page: 100
	}
    );
})

import React, {PropTypes} from 'react';
import PostSummary from 'app/components/cards/PostSummary';
import LoadingIndicator from 'app/components/elements/LoadingIndicator';
import shouldComponentUpdate from 'app/utils/shouldComponentUpdate';

function topPosition(domElt) {
    if (!domElt) {
        return 0;
    }
    return domElt.offsetTop + topPosition(domElt.offsetParent);
}

class PostsList extends React.Component {

    static propTypes = {
        posts: PropTypes.array.isRequired,
        loading: PropTypes.bool.isRequired,
        category: PropTypes.string,
        loadMore: PropTypes.func,
        emptyText: PropTypes.string
    };

    constructor() {
        super();
        this.state = {
            thumbSize: 'desktop',
            showNegativeComments: false,
        }
        this.scrollListener = this.scrollListener.bind(this);
        this.shouldComponentUpdate = shouldComponentUpdate(this, 'PostsList')
    }

    componentDidMount() {
        this.attachScrollListener();
    }

    componentWillUnmount() {
        this.detachScrollListener();
    }

    fetchIfNeeded() {
        this.scrollListener();
    }

    toggleNegativeReplies = () => {
        this.setState({
            showNegativeComments: !this.state.showNegativeComments
        });
    }

    scrollListener() {
        const el = window.document.getElementById('posts_list');
        if (!el) return;
        const scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset :
            (document.documentElement || document.body.parentNode || document.body).scrollTop;
        if (topPosition(el) + el.offsetHeight - scrollTop - window.innerHeight < 10) {
            const {loadMore, posts, category} = this.props;
            if (loadMore && posts && posts.length > 0) loadMore(posts[posts.length - 1], category);
        }

        // Detect if we're in mobile mode (renders larger preview imgs)
        var mq = window.matchMedia('screen and (max-width: 39.9375em)')
        if(mq.matches) {
            this.setState({thumbSize: 'mobile'})
        } else {
            this.setState({thumbSize: 'desktop'})
        }
    }

    attachScrollListener() {
        window.addEventListener('scroll', this.scrollListener);
        window.addEventListener('resize', this.scrollListener);
        this.scrollListener();
    }

    detachScrollListener() {
        window.removeEventListener('scroll', this.scrollListener);
        window.removeEventListener('resize', this.scrollListener);
    }

    render() {
        const {posts, loading, category, emptyText} = this.props;
        const {positiveComments, negativeComments} = this.props
        const {thumbSize, showNegativeComments} = this.state

        if (!loading && !posts.length) {
            return <div>{emptyText}</div>;
        }
        const negativeGroup = negativeComments.length === 0 ? null :
            (<div className="hentry Comment root Comment__negative_group">
                {showNegativeComments ?
                    <p>Now showing {negativeComments.length} posts with low ratings: <button style={{marginBottom: 0}} className="button hollow tiny float-right" onClick={this.toggleNegativeReplies}>Hide</button></p> :
                    <p>{negativeComments.length} posts were hidden due to low ratings. <button style={{marginBottom: 0}} className="button hollow tiny float-right" onClick={this.toggleNegativeReplies}>Show</button></p>
                }
            </div>
        );
        const renderSummary = items => items.map(({item, ignore, netVoteSign}) => <li key={item}>
            <PostSummary post={item} currentCategory={category} thumbSize={thumbSize}
                ignore={ignore} netVoteSign={netVoteSign} />
        </li>)
        return (
            <div id="posts_list" className="PostsList">
                <ul className="PostsList__summaries hfeed" itemScope itemType="http://schema.org/blogPosts">
                    {renderSummary(positiveComments)}
                    {negativeGroup}
                    {showNegativeComments && renderSummary(negativeComments)}
                </ul>
                {loading && <center><LoadingIndicator type="circle" /></center>}
            </div>
        );
    }
}

import {List} from 'immutable'
import {Long} from 'bytebuffer'
import {connect} from 'react-redux'
import {parsePayoutAmount} from 'app/utils/ParsersAndFormatters';

export default connect(
    (state, props) => {
        const {posts} = props;
        const positiveComments = []
        const negativeComments = []
        posts.forEach(item => {
            const content = state.global.get('content').get(item);
            let pending_payout = 0;
            // let total_payout = 0;
            let votes = Long.ZERO
            if (content) {
                pending_payout = content.get('pending_payout_value');
                // total_payout = content.get('total_payout_value');
                content.get('active_votes').forEach(v => {
                    votes = votes.add(Long.fromString('' + v.get('rshares')))
                })
            }
            const netVoteSign = votes.compare(Long.ZERO)
            const hasPendingPayout = parsePayoutAmount(pending_payout) >= 0.02
            const current = state.user.get('current')
            const username = current ? current.get('username') : null
            const ignore = !hasPendingPayout && username ? state.global.getIn(['follow', 'get_following', username, 'result', content.get('author')], List()).contains('ignore') : false
            const show = !ignore || hasPendingPayout
            if(show)
                positiveComments.push({item, ignore, netVoteSign})
            else {
                negativeComments.push({item, ignore, netVoteSign})
            }
        })
        return {...props, positiveComments, negativeComments};
    },
)(PostsList)

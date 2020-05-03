import ProfileView from '../views/Profile';

export async function getServerSideProps(ctx) {
    if (!ctx.req.user || !ctx.req.user.user_id) {
        ctx.res.redirect('/login');
        return {props: {}};
    }

    return {
        props: {
            user: ctx.req.user,
        }
    }
}

export default ProfileView;
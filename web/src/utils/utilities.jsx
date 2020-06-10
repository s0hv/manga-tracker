import throttle from 'lodash.throttle';


export const followUnfollow = (mangaId, serviceId) => {
  const url = serviceId ? `/api/user/follows?manga_id=${mangaId}&service_id=${serviceId}` :
                           `/api/user/follows?manga_id=${mangaId}`;
  return throttle((event) => {
    const target = event.target;
    switch (target.textContent.toLowerCase()) {
      case 'follow':
        fetch(url, {credentials: 'include', method: 'put'})
            .then(res => {
              if (res.status === 200) {
                target.textContent = 'Unfollow';
              }
            });
        break;

      case "unfollow":
        fetch(url, {credentials: 'include', method: 'delete'})
            .then(res => {
              if (res.status === 200) {
                target.textContent = 'Follow';
              }
            });
        break;

      default:
        target.textContent = 'Follow';
        return;
    }
  }, 200, {trailing: false});
}

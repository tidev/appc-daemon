# ![Appc Daemon logo](images/appc-daemon.png) Daemon Project

## appcd Package and Plugin Dependencies

The Appc Daemon is comprised of several packages and plugins of which several are dependent on one
another.

It is critical that there are no cyclic dependencies. To ensure there are no cyclic dependencies,
run:

```
$ gulp cyclic
```

### Dependency Map

Last Updated 11/3/2017

![Packages](images/packages.png)
